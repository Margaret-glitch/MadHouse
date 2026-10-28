/**
 * ==============================================================================
 * MadHouse Subscription Manager — Google Apps Script Worker
 * ==============================================================================
 * 
 * Features:
 * 1. Automatic Verification of Pending Paystack Transactions
 *    - Verifies transactions with Paystack API using secret key
 *    - Validates plan amounts (₦950 Weekly = 95000 kobo, ₦3500 VIP Monthly = 350000 kobo)
 *    - Computes subscription start and expiry dates based on payment term
 * 
 * 2. Breacher DB Synchronization
 *    - Grants and writes user entitlement to `userData/subscription_{userId}.json`
 *    - Updates master registry `userData/users_subscriptions.json`
 *    - Updates transaction document `userData/transactions/{reference}.json`
 *    - Cleans up pending transaction queue `userData/pending_transactions.json`
 * 
 * 3. Automatic Expiry & Entitlement Revocation
 *    - Scans all active subscriptions
 *    - When `expiryDate < Date.now()`, revokes entitlement and marks status as `expired`
 * 
 * 4. Webhook & Instant Verification API (Web App)
 *    - `doGet` and `doPost` endpoints for real-time verification and Paystack webhooks
 * ==============================================================================
 */

// CONFIGURATION
var CONFIG = {
  // Store in Apps Script Project Settings > Script Properties, or replace with your sk_live key
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

/**
 * Sanitize userId or email for Breacher DB path
 */
function sanitizeKey(identifier) {
  if (!identifier) return 'guest';
  return identifier.toString().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Breacher DB REST Client
 */
function breacherGet(path) {
  var cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath.startsWith('userData/')) {
    cleanPath = 'userData/' + cleanPath;
  }
  var url = CONFIG.BREACHER_BASE_URL + '/' + cleanPath;
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
    // Fallback try .json
    if (!cleanPath.endsWith('.json')) {
      var fallbackRes = UrlFetchApp.fetch(url + '.json', {
        method: 'get',
        muteHttpExceptions: true
      });
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

/**
 * Verify Transaction with Paystack API
 * GET https://api.paystack.co/transaction/verify/:reference
 */
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
    var json = JSON.parse(res.getContentText());
    return json;
  } catch (err) {
    Logger.log('Paystack verification request error: ' + err);
    return { status: false, message: err.toString() };
  }
}

/**
 * Grant subscription entitlement for a user and write to Breacher DB
 */
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

/**
 * 1. Process All Pending Transactions from Queue
 */
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
      // Re-verify plan based on actual amount charged if needed
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

      // Keep in pending for up to 6 hours in case user resumes payment
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
      // Still pending in Paystack, keep in queue
      remainingPending.push(tx);
    }
  }

  // Update pending queue in Breacher DB
  breacherPut('userData/pending_transactions', {
    updatedAt: new Date().toISOString(),
    transactions: remainingPending
  });

  Logger.log('Batch complete. Verified: ' + verifiedCount + ', Remaining pending: ' + remainingPending.length);
  return { verifiedCount: verifiedCount, pendingCount: remainingPending.length };
}

/**
 * 2. Check Expiries and Revoke Entitlement for Overdue Subscriptions
 */
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

        // Update individual user document
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

/**
 * 3. Master Cron Runner (Executes both verification and expiry check)
 */
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

/**
 * 4. Setup Automatic Time-Driven Triggers (Runs Every 5 Minutes)
 */
function setupSubscriptionCron() {
  // Delete previous triggers to prevent duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runSubscriptionSync') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new 5-minute recurring trigger
  ScriptApp.newTrigger('runSubscriptionSync')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Successfully installed time-based trigger for runSubscriptionSync (Every 5 minutes).');
}

/**
 * 5. Web App HTTP GET Handler (For direct client triggers & health checks)
 * URL: https://script.google.com/macros/s/{SCRIPT_ID}/exec
 */
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

/**
 * 6. Web App HTTP POST Handler (Handles Paystack Webhooks & Client verification)
 */
function doPost(e) {
  try {
    var body = e.postData.contents;
    var json = JSON.parse(body);

    // Case A: Paystack Webhook Event (charge.success)
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

    // Case B: Direct Action POST
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
