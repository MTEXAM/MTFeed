/**
 * Complete Google Apps Script template for Google Sheets & Google Drive
 * Includes:
 * 1. Automatic pre-deletion of any file with the same name in Google Drive (App_Images / MTFeed_Profiles) before saving
 * 2. Case-insensitive header matching (UID, Username, DisplayName, ProfileImage, LastUpdate)
 * 3. In-place update of user row (no duplicate rows in Google Sheets)
 * 4. 1-Click System Reset (cleanAndResetAll / resetAllDataNow)
 */
export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * =========================================================================
 * MTFeed - Google Apps Script (Production Ready)
 * จัดการ Google Drive และ Google Sheets:
 * - ลบไฟล์รูปที่มีชื่อเดียวกันใน Google Drive ออกให้หมดก่อน แล้วค่อยส่งไฟล์ใหม่เข้าไป
 * - ค้นหาคอลัมน์แบบไม่สนตัวพิมพ์เล็ก/ใหญ่ (UID, Username, DisplayName, ProfileImage, LastUpdate)
 * - อัปเดตข้อมูลทับแถวเดิม (ไม่สร้างแถวซ้ำ)
 * - มีฟังก์ชัน cleanAndResetAll() สำหรับล้างไฟล์ซ้ำในไดรฟ์และล้างข้อมูลในชีต
 * =========================================================================
 */

// ฟังก์ชันหาตำแหน่งคอลัมน์แบบไม่สนใจตัวพิมพ์เล็ก-ใหญ่
function getColIndex(headers, possibleNames) {
  if (!headers || !headers.length) return -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (var j = 0; j < possibleNames.length; j++) {
      var p = String(possibleNames[j] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (h === p) return i;
    }
  }
  return -1;
}

// ฟังก์ชันหาโฟลเดอร์สำหรับเก็บรูป (รองรับทั้ง App_Images และ MTFeed_Profiles)
function getTargetFolder() {
  var names = ['App_Images', 'MTFeed_Profiles'];
  for (var i = 0; i < names.length; i++) {
    var folders = DriveApp.getFoldersByName(names[i]);
    if (folders.hasNext()) return folders.next();
  }
  return DriveApp.createFolder('App_Images');
}

// ฟังก์ชันลบไฟล์เดิมของผู้ใช้นี้ใน Google Drive ออกทั้งหมด (ทั้งตาม ID และตามชื่อในโฟลเดอร์)
function trashOldFilesForUser(uid, username, oldFileUrlOrId) {
  // 1. ลบจาก URL หรือ File ID เดิมทันที (แม่นยำ 100%)
  if (oldFileUrlOrId) {
    var match = String(oldFileUrlOrId).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(oldFileUrlOrId).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    var targetId = match ? match[1] : (String(oldFileUrlOrId).length > 20 ? String(oldFileUrlOrId).trim() : null);
    if (targetId) {
      try { DriveApp.getFileById(targetId).setTrashed(true); } catch(e) {}
    }
  }

  // 2. ตรวจสอบไฟล์ทั้งหมดในโฟลเดอร์ App_Images, MTFeed_Profiles และ MTFeed_Uploads
  var u1 = (uid || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  var u2 = (username || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  var folderNames = ['App_Images', 'MTFeed_Profiles', 'MTFeed_Uploads'];
  for (var f = 0; f < folderNames.length; f++) {
    var fIter = DriveApp.getFoldersByName(folderNames[f]);
    while (fIter.hasNext()) {
      var folder = fIter.next();
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fname = file.getName().toLowerCase();
        var isMatch = false;
        if (u1 && fname.indexOf(u1) !== -1) isMatch = true;
        if (u2 && fname.indexOf(u2) !== -1) isMatch = true;
        if (isMatch) {
          try { folder.removeFile(file); } catch(e) {}
          try { file.setTrashed(true); } catch(e) {}
        }
      }
    }
  }
}

function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : 'getFeed';
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ดึงฟีดโพสต์ทั้งหมด
  if (action === 'getFeed' || !action) {
    var sheet = ss.getSheetByName('Feed');
    if (!sheet) {
      sheet = ss.insertSheet('Feed');
      sheet.appendRow(['PostID', 'UID', 'Username', 'DisplayName', 'ProfileImage', 'Content', 'Timestamp']);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var headers = data[0];
    var rows = data.slice(1);
    var posts = rows.map(function(r) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = r[i]; });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: posts }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ดึงข้อมูลโปรไฟล์ผู้ใช้ (ค้นหาแถวที่อัปเดตล่าสุดและลบแถวซ้ำซ้อน)
  if (action === 'getProfile') {
    var uid = String((e && e.parameter && e.parameter.uid) || '').replace(/^#/, '').trim();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Users sheet not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var uidIdx = getColIndex(headers, ['uid', 'id', 'userid']);
    var uNameIdx = getColIndex(headers, ['username', 'user', 'handle']);
    var dNameIdx = getColIndex(headers, ['displayname', 'name', 'author', 'fullname']);
    var imgIdx = getColIndex(headers, ['profileimage', 'avatar', 'image', 'picture', 'photo']);
    var timeIdx = getColIndex(headers, ['lastupdate', 'updatedat', 'timestamp', 'date', 'time']);

    var matchedProfile = null;
    var newestTime = 0;

    for (var i = 1; i < data.length; i++) {
      var rowUid = String(uidIdx !== -1 ? data[i][uidIdx] : data[i][0] || '').replace(/^#/, '').trim();
      var rowUName = String(uNameIdx !== -1 ? data[i][uNameIdx] : '').replace(/^@/, '').trim();

      if (rowUid.toLowerCase() === uid.toLowerCase() || (rowUName && rowUName.toLowerCase() === uid.toLowerCase())) {
        var rowTimeStr = timeIdx !== -1 ? String(data[i][timeIdx] || '') : '';
        var rowTime = rowTimeStr ? new Date(rowTimeStr).getTime() : 0;
        if (!matchedProfile || rowTime >= newestTime) {
          newestTime = rowTime;
          matchedProfile = {
            uid: rowUid,
            username: uNameIdx !== -1 ? data[i][uNameIdx] : '',
            displayName: dNameIdx !== -1 ? data[i][dNameIdx] : '',
            profileImage: imgIdx !== -1 ? data[i][imgIdx] : '',
            lastUpdate: rowTimeStr
          };
        }
      }
    }

    if (matchedProfile) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: matchedProfile }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'not_found', message: 'User not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================
    // 1. UPDATE PROFILE
    // ==========================================
    if (action === 'updateProfile') {
      var usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) {
        usersSheet = ss.insertSheet('Users');
        usersSheet.appendRow(['UID', 'Username', 'DisplayName', 'ProfileImage', 'LastUpdate']);
      }

      var uid = String(data.uid || data.username || '').replace(/^#/, '').trim();
      var username = String(data.username || '').replace(/^@/, '').trim();
      var displayName = String(data.displayName || data.name || username || 'User').trim();
      var profileImageUrl = data.profileImage || '';

      // ค้นหาแถวของผู้ใช้นี้ใน Google Sheets ก่อนเสมอ เพื่อดึง URL รูปเดิม
      var uData = usersSheet.getDataRange().getValues();
      var uHeaders = uData[0];
      var uidIdx = getColIndex(uHeaders, ['uid', 'id', 'userid']);
      var uNameIdx = getColIndex(uHeaders, ['username', 'user', 'handle']);
      var dNameIdx = getColIndex(uHeaders, ['displayname', 'name', 'author', 'fullname']);
      var imgIdx = getColIndex(uHeaders, ['profileimage', 'avatar', 'image', 'picture', 'photo']);
      var timeIdx = getColIndex(uHeaders, ['lastupdate', 'updatedat', 'timestamp', 'date', 'time']);

      // Find ALL matching rows for this user (both by UID and Username)
      var matchingRows = [];
      var existingOldProfileUrls = [];
      for (var j = 1; j < uData.length; j++) {
        var existingUid = String(uidIdx !== -1 ? uData[j][uidIdx] : uData[j][0] || '').replace(/^#/, '').trim();
        var existingUName = String(uNameIdx !== -1 ? uData[j][uNameIdx] : '').replace(/^@/, '').trim();
        if (existingUid.toLowerCase() === uid.toLowerCase() || (username && existingUName.toLowerCase() === username.toLowerCase())) {
          matchingRows.push(j + 1);
          if (imgIdx !== -1 && uData[j][imgIdx]) {
            existingOldProfileUrls.push(String(uData[j][imgIdx]));
          }
        }
      }

      // หากส่งรูปภาพใหม่มาเป็น Base64
      if (profileImageUrl && profileImageUrl.indexOf('data:image') === 0) {
        var folder = getTargetFolder();

        // 1. ลบไฟล์เดิมของผู้ใช้นี้ใน Google Drive ออกให้หมด
        var oldUrlCandidates = existingOldProfileUrls.concat([data.oldFileId, data.oldProfileImage]).filter(Boolean);
        trashOldFilesForUser(uid, username, oldUrlCandidates.join(','));

        // 2. สร้างไฟล์รูปภาพใหม่ในไดรฟ์
        var contentType = profileImageUrl.substring(5, profileImageUrl.indexOf(';'));
        var base64Data = profileImageUrl.substring(profileImageUrl.indexOf(',') + 1);
        var bytes = Utilities.base64Decode(base64Data);
        var ext = contentType.indexOf('png') !== -1 ? '.png' : '.jpg';
        var newFileName = 'profile_' + uid + ext;
        var blob = Utilities.newBlob(bytes, contentType, newFileName);
        var newFile = folder.createFile(blob);
        newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        profileImageUrl = 'https://lh3.googleusercontent.com/d/' + newFile.getId();
      }

      var nowIso = new Date().toISOString();
      var targetRow = matchingRows.length > 0 ? matchingRows[0] : -1;

      if (targetRow > 0) {
        // อัปเดตแถวแรก
        if (uidIdx !== -1) usersSheet.getRange(targetRow, uidIdx + 1).setValue(uid);
        if (uNameIdx !== -1) usersSheet.getRange(targetRow, uNameIdx + 1).setValue(username);
        if (dNameIdx !== -1) usersSheet.getRange(targetRow, dNameIdx + 1).setValue(displayName);
        if (imgIdx !== -1 && profileImageUrl) usersSheet.getRange(targetRow, imgIdx + 1).setValue(profileImageUrl);
        if (timeIdx !== -1) usersSheet.getRange(targetRow, timeIdx + 1).setValue(nowIso);

        // ลบแถวที่ซ้ำซ้อนทั้งหมดที่เหลือทิ้งทันที! (ลบจากล่างขึ้นบน)
        for (var k = matchingRows.length - 1; k >= 1; k--) {
          try {
            usersSheet.deleteRow(matchingRows[k]);
          } catch(err) {}
        }
      } else {
        // เพิ่มแถวใหม่
        var newRow = [];
        for (var c = 0; c < uHeaders.length; c++) newRow.push('');
        if (uidIdx !== -1) newRow[uidIdx] = uid; else newRow[0] = uid;
        if (uNameIdx !== -1) newRow[uNameIdx] = username;
        if (dNameIdx !== -1) newRow[dNameIdx] = displayName;
        if (imgIdx !== -1) newRow[imgIdx] = profileImageUrl;
        if (timeIdx !== -1) newRow[timeIdx] = nowIso;
        usersSheet.appendRow(newRow);
      }

      // อัปเดต Feed ให้เป็นรูปใหม่ด้วย เพื่อไม่ให้รูปเก่าค้างในฟีด
      try {
        var feedSheet = ss.getSheetByName('Feed');
        if (feedSheet && profileImageUrl) {
          var fData = feedSheet.getDataRange().getValues();
          if (fData.length > 1) {
            var fHeaders = fData[0];
            var fUidIdx = getColIndex(fHeaders, ['uid', 'authorid', 'userid']);
            var fUNameIdx = getColIndex(fHeaders, ['username', 'user']);
            var fImgIdx = getColIndex(fHeaders, ['profileimage', 'avatar', 'userimage']);
            var fNameIdx = getColIndex(fHeaders, ['displayname', 'name', 'author']);

            for (var f = 1; f < fData.length; f++) {
              var fUid = String(fUidIdx !== -1 ? fData[f][fUidIdx] : '').replace(/^#/, '').trim();
              var fUName = String(fUNameIdx !== -1 ? fData[f][fUNameIdx] : '').replace(/^@/, '').trim();
              if (fUid.toLowerCase() === uid.toLowerCase() || (username && fUName.toLowerCase() === username.toLowerCase())) {
                if (fImgIdx !== -1) feedSheet.getRange(f + 1, fImgIdx + 1).setValue(profileImageUrl);
                if (fNameIdx !== -1 && displayName) feedSheet.getRange(f + 1, fNameIdx + 1).setValue(displayName);
              }
            }
          }
        }
      } catch(err) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        updatedProfile: true,
        profileImage: profileImageUrl,
        displayName: displayName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 2. DELETE USER
    // ==========================================
    if (action === 'deleteUser') {
      var uid = String(data.uid || data.username || '').replace(/^#/, '').trim();
      var usersSheet = ss.getSheetByName('Users');
      if (usersSheet && uid) {
        var uData = usersSheet.getDataRange().getValues();
        var uidIdx = getColIndex(uData[0], ['uid', 'id', 'userid']);
        for (var d = uData.length - 1; d >= 1; d--) {
          var rowUid = String(uidIdx !== -1 ? uData[d][uidIdx] : uData[d][0] || '').replace(/^#/, '').trim();
          if (rowUid.toLowerCase() === uid.toLowerCase()) {
            usersSheet.deleteRow(d + 1);
          }
        }
      }
      deleteExistingFilesByName('profile_' + uid);
      if (data.username) deleteExistingFilesByName('profile_' + data.username);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', deleted: uid }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 3. CREATE POST
    // ==========================================
    if (action === 'createPost') {
      var feedSheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
      var imageUrl = data.image || '';
      var pdfUrl = data.pdf || '';

      if (imageUrl && imageUrl.indexOf('data:image') === 0) {
        var postFolder = getTargetFolder();
        var imgType = imageUrl.substring(5, imageUrl.indexOf(';'));
        var imgBytes = Utilities.base64Decode(imageUrl.substring(imageUrl.indexOf(',') + 1));
        var imgBlob = Utilities.newBlob(imgBytes, imgType, 'post_' + Date.now() + '.jpg');
        var imgFile = postFolder.createFile(imgBlob);
        imgFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = 'https://lh3.googleusercontent.com/d/' + imgFile.getId();
      }

      feedSheet.appendRow([
        data.postId || ('post_' + Date.now()),
        data.uid || '',
        data.displayName || data.author || '',
        data.username || '',
        data.profileImage || '',
        data.content || '',
        imageUrl,
        pdfUrl,
        data.pdfName || '',
        new Date().toISOString()
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        postId: data.postId,
        imageUrl: imageUrl,
        pdfUrl: pdfUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 4. DELETE POST
    // ==========================================
    if (action === 'deletePost') {
      var feedSheet = ss.getSheetByName('Feed');
      if (feedSheet) {
        var data = feedSheet.getDataRange().getValues();
        var postIdIndex = -1;
        var headers = data[0];
        
        // Find PostID column index
        for (var i = 0; i < headers.length; i++) {
          if (headers[i] === 'PostID' || headers[i] === 'postId' || headers[i] === 'id') {
            postIdIndex = i;
            break;
          }
        }
        
        if (postIdIndex >= 0 && data.postId) {
          // Iterate backwards to safely delete rows
          var deletedCount = 0;
          for (var r = data.length - 1; r >= 1; r--) {
            if (data[r][postIdIndex] == data.postId) {
              feedSheet.deleteRow(r + 1);
              deletedCount++;
            }
          }
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Post deleted successfully',
            deletedCount: deletedCount
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Post not found or PostID column missing' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 5. RESET ALL DATA
    // ==========================================
    if (action === 'resetData' || action === 'resetAll') {
      cleanAndResetAll();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        resetComplete: true,
        message: 'All duplicate files in Drive trashed and Google Sheets reset'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// ฟังก์ชันล้างข้อมูลทั้งหมด (กดปุ่ม "เรียกใช้ (Run)" บนหัวโปรแกรม Apps Script ได้เลย!)
// =========================================================================
function cleanAndResetAll() {
  // 1. ลบไฟล์ทั้งหมดในโฟลเดอร์ App_Images, MTFeed_Profiles, MTFeed_Uploads
  var folderNames = ['App_Images', 'MTFeed_Profiles', 'MTFeed_Uploads'];
  for (var f = 0; f < folderNames.length; f++) {
    var folders = DriveApp.getFoldersByName(folderNames[f]);
    while (folders.hasNext()) {
      var fol = folders.next();
      var files = fol.getFiles();
      while (files.hasNext()) {
        try { files.next().setTrashed(true); } catch(e) {}
      }
    }
  }

  // 2. ค้นหาและลบไฟล์ profile_*.jpg ทั้งหมดที่อาจหลงเหลืออยู่ในไดรฟ์
  try {
    var searchFiles = DriveApp.searchFiles("title contains 'profile_' and trashed = false");
    while (searchFiles.hasNext()) {
      try { searchFiles.next().setTrashed(true); } catch(e) {}
    }
  } catch(e) {}

  // 3. ล้างชีต Users ให้เหลือเฉพาะหัวตารางและแอดมินค่าเริ่มต้น MED68001
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('Users');
  if (usersSheet) {
    var lastRow = usersSheet.getLastRow();
    if (lastRow > 1) {
      usersSheet.deleteRows(2, lastRow - 1);
    }
    usersSheet.appendRow([
      'MED68001',
      'bank',
      'Bank',
      'https://lh3.googleusercontent.com/d/1ylD5QrEMSWIuWSNR4eHr6x9F4V5KZoe3',
      new Date().toISOString()
    ]);
  }

  // 4. ล้างชีต Feed
  var feedSheet = ss.getSheetByName('Feed');
  if (feedSheet) {
    var fLastRow = feedSheet.getLastRow();
    if (fLastRow > 1) {
      feedSheet.deleteRows(2, fLastRow - 1);
    }
  }

  Logger.log('✅ ล้างข้อมูลใน Google Drive และ Google Sheets เรียบร้อยแล้ว!');
}

function resetAllDataNow() {
  cleanAndResetAll();
}
`;
