/**
 * ==============================================================================
 * MadHouse Subscription Manager — Google Apps Script Worker
 * ==============================================================================
 * Copy & Paste this entire script into your Google Apps Script editor (https://script.google.com).
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open https://script.google.com and click "New Project".
 * 2. Paste this code into "Code.gs".
 * 3. Run the function `setupSubscriptionCron()` once.
 *    - This sets up an automated background trigger running every 5 minutes to verify pending payments and revoke expired entitlements.
 * 4. (Optional) Deploy as Web App:
 *    - Click "Deploy" > "New deployment" > Select type "Web app".
 *    - Execute as: "Me", Who has access: "Anyone".
 *    - Copy the Web App URL and set it as your Paystack Webhook URL in your Paystack Dashboard (https://dashboard.paystack.com/#/settings/developer).
 * ==============================================================================
 */

var CONFIG = {
  // Set PAYSTACK_SECRET_KEY in Project Settings > Script Properties, or replace with your sk_live key
  PAYSTACK_SECRET_KEY: PropertiesService.getScriptProperties().getProperty('PAYSTACK_SECRET_KEY') || 'YOUR_PAYSTACK_SECRET_KEY',
  BREACHER_BASE_URL: 'https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db',
  PLANS: {
    'weekly': {
      id: 'weekly',
      name: 'Weekly Pass',
      amountKobo: 95000,
      termDays: 7
    },
    'vip_monthly': {
      id: 'vip_monthly',
      name: 'VIP Monthly',
      amountKobo: 350000,
      termDays: 30
    }
  }
};

function sanitizeKey(identifier) {
  if (!identifier) return 'guest';
  return identifier.toString().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function breacherGet(path) {
  var cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath.startsWith('userData/')) {
    cleanPath = 'userData/' + cleanPath;
  }
  var url = CONFIG.BREACHER_BASE_URL + '/' + cleanPath;
  try {
    var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
    if (!cleanPath.endsWith('.json')) {
      var fallbackRes = UrlFetchApp.fetch(url + '.json', { method: 'get', muteHttpExceptions: true });
      if (fallbackRes.getResponseCode() === 200) {
        return JSON.parse(fallbackRes.getContentText());
      }
    }
    return null;
  } catch (err) {
    Logger.log('Breacher GET error (' + path + '): ' + err);
    return null;
  }
}

function breacherPut(path, data) {
  var cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath.startsWith('userData/')) {
    cleanPath = 'userData/' + cleanPath;
  }
  var url = CONFIG.BREACHER_BASE_URL + '/' + cleanPath;
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    });
    return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
  } catch (err) {
    Logger.log('Breacher PUT error (' + path + '): ' + err);
    return false;
  }
}

function verifyPaystack(reference) {
  var url = 'https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference);
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.PAYSTACK_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText());
  } catch (err) {
    Logger.log('Paystack verification error: ' + err);
    return { status: false, message: err.toString() };
  }
}

function grantEntitlement(userId, userEmail, planId, reference, paystackData) {
  var userKey = sanitizeKey(userId || userEmail);
  var plan = CONFIG.PLANS[planId] || CONFIG.PLANS['vip_monthly'];

  var now = new Date();
  var paidAt = (paystackData && paystackData.paid_at) ? new Date(paystackData.paid_at) : now;
  var expiryDate = new Date(paidAt.getTime() + (plan.termDays * 24 * 60 * 60 * 1000));

  var subRecord = {
    userId: userId || userEmail,
    userEmail: userEmail || '',
    planId: plan.id,
    planName: plan.name,
    amount: paystackData ? paystackData.amount : plan.amountKobo,
    reference: reference,
    status: 'active',
    entitlement: true,
    startDate: paidAt.toISOString(),
    expiryDate: expiryDate.toISOString(),
    daysLeft: plan.termDays,
    updatedAt: now.toISOString()
  };

  // 1. Write user subscription doc: userData/subscription_{userKey}.json
  breacherPut('userData/subscription_' + userKey, subRecord);

  // 2. Update master subscriptions registry: userData/users_subscriptions.json
  var master = breacherGet('userData/users_subscriptions') || { subscriptions: {} };
  var subs = master.subscriptions || {};
  subs[userKey] = subRecord;
  breacherPut('userData/users_subscriptions', {
    updatedAt: now.toISOString(),
    subscriptions: subs
  });

  // 3. Update individual transaction status: userData/transactions/{reference}.json
  breacherPut('userData/transactions/' + reference, {
    reference: reference,
    userId: userId,
    userEmail: userEmail,
    planId: plan.id,
    planName: plan.name,
    amount: subRecord.amount,
    termDays: plan.termDays,
    status: 'verified',
    createdAt: paidAt.toISOString(),
    updatedAt: now.toISOString(),
    paystackResponse: paystackData
  });

  Logger.log('[ENTITLEMENT GRANTED] User: ' + userEmail + ' | Plan: ' + plan.name + ' | Expires: ' + expiryDate.toISOString());
  return subRecord;
}

function verifyPendingTransactions() {
  Logger.log('Checking pending transactions from Breacher DB...');
  var queueDoc = breacherGet('userData/pending_transactions');
  if (!queueDoc || !queueDoc.transactions || !queueDoc.transactions.length) {
    Logger.log('No pending transactions to process.');
    return { verifiedCount: 0, pendingCount: 0 };
  }

  var pendingList = queueDoc.transactions;
  var remainingPending = [];
  var verifiedCount = 0;

  for (var i = 0; i < pendingList.length; i++) {
    var tx = pendingList[i];
    Logger.log('Verifying transaction ref: ' + tx.reference);

    var res = verifyPaystack(tx.reference);
    if (res && res.status && res.data && res.data.status === 'success') {
      var data = res.data;
      var planId = tx.planId;
      if (data.amount === 95000) {
        planId = 'weekly';
      } else if (data.amount === 350000) {
        planId = 'vip_monthly';
      }

      grantEntitlement(tx.userId, tx.userEmail, planId, tx.reference, data);
      verifiedCount++;
    } else if (res && res.data && (res.data.status === 'failed' || res.data.status === 'abandoned')) {
      var createdAt = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
      var ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);

      if (ageHours > 6) {
        Logger.log('Marking abandoned transaction as failed: ' + tx.reference);
        breacherPut('userData/transactions/' + tx.reference, {
          reference: tx.reference,
          status: 'failed',
          updatedAt: new Date().toISOString()
        });
      } else {
        remainingPending.push(tx);
      }
    } else {
      remainingPending.push(tx);
    }
  }

  breacherPut('userData/pending_transactions', {
    updatedAt: new Date().toISOString(),
    transactions: remainingPending
  });

  Logger.log('Batch complete. Verified: ' + verifiedCount + ', Remaining pending: ' + remainingPending.length);
  return { verifiedCount: verifiedCount, pendingCount: remainingPending.length };
}

function revokeExpiredSubscriptions() {
  Logger.log('Scanning active subscriptions for expiration...');
  var master = breacherGet('userData/users_subscriptions');
  if (!master || !master.subscriptions) {
    Logger.log('No subscriptions registry found.');
    return { revokedCount: 0 };
  }

  var subs = master.subscriptions;
  var now = Date.now();
  var revokedCount = 0;
  var hasChanges = false;

  for (var userKey in subs) {
    var sub = subs[userKey];
    if (sub && sub.status === 'active' && sub.expiryDate) {
      var expiryTime = new Date(sub.expiryDate).getTime();
      if (now > expiryTime) {
        Logger.log('[REVOKING ENTITLEMENT] User: ' + (sub.userEmail || userKey) + ' | Expired on: ' + sub.expiryDate);
        sub.status = 'expired';
        sub.entitlement = false;
        sub.daysLeft = 0;
        sub.updatedAt = new Date().toISOString();

        breacherPut('userData/subscription_' + userKey, sub);
        revokedCount++;
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    breacherPut('userData/users_subscriptions', {
      updatedAt: new Date().toISOString(),
      subscriptions: subs
    });
  }

  Logger.log('Expiry sweep complete. Revoked count: ' + revokedCount);
  return { revokedCount: revokedCount };
}

function runSubscriptionSync() {
  Logger.log('=== STARTING MADHOUSE SUBSCRIPTION SYNC JOB ===');
  var verifyResult = verifyPendingTransactions();
  var expiryResult = revokeExpiredSubscriptions();
  Logger.log('=== MADHOUSE SUBSCRIPTION SYNC JOB FINISHED ===');
  return {
    success: true,
    verified: verifyResult.verifiedCount,
    pending: verifyResult.pendingCount,
    revoked: expiryResult.revokedCount,
    timestamp: new Date().toISOString()
  };
}

function setupSubscriptionCron() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runSubscriptionSync') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('runSubscriptionSync')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Successfully installed time-based trigger for runSubscriptionSync (Every 5 minutes).');
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'status';
  var reference = (e && e.parameter && e.parameter.reference) ? e.parameter.reference : null;
  var userId = (e && e.parameter && e.parameter.userId) ? e.parameter.userId : null;
  var userEmail = (e && e.parameter && e.parameter.email) ? e.parameter.email : null;

  if (action === 'verify' && reference) {
    var paystackRes = verifyPaystack(reference);
    if (paystackRes && paystackRes.status && paystackRes.data && paystackRes.data.status === 'success') {
      var planId = paystackRes.data.amount === 95000 ? 'weekly' : 'vip_monthly';
      var record = grantEntitlement(userId, userEmail, planId, reference, paystackRes.data);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Subscription verified and granted',
        subscription: record
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Transaction not verified or pending in Paystack',
        paystack: paystackRes
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'sync') {
    var result = runSubscriptionSync();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    service: 'MadHouse Subscription Manager',
    status: 'online',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = e.postData.contents;
    var json = JSON.parse(body);

    if (json.event === 'charge.success' && json.data) {
      var chargeData = json.data;
      var ref = chargeData.reference;
      var metadata = chargeData.metadata || {};
      var uid = metadata.userId || chargeData.customer.email;
      var uemail = metadata.userEmail || chargeData.customer.email;
      var plan = chargeData.amount === 95000 ? 'weekly' : 'vip_monthly';

      var granted = grantEntitlement(uid, uemail, plan, ref, chargeData);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        eventHandled: 'charge.success',
        subscription: granted
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (json.action === 'verify' && json.reference) {
      var paystackRes = verifyPaystack(json.reference);
      if (paystackRes && paystackRes.status && paystackRes.data && paystackRes.data.status === 'success') {
        var planId = paystackRes.data.amount === 95000 ? 'weekly' : 'vip_monthly';
        var record = grantEntitlement(json.userId, json.userEmail, planId, json.reference, paystackRes.data);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          subscription: record
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Webhook received'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
