/**
 * Complete Google Apps Script template for Google Sheets & Google Drive
 * Includes:
 * 1. Automatic pre-deletion of any file with the same name before saving new profile image
 * 2. Reset system & Drive cleanup action ('resetData')
 * 3. Delete user & post cleanup ('deleteUser', 'deletePost')
 */
export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * MTFeed Google Sheets & Google Drive Integration Script
 * ระบบซิงก์ข้อมูลสองทาง + จัดการ Google Drive อัจฉริยะ:
 * - ลบไฟล์เดิมที่มีชื่อซ้ำกันออกก่อนเสมอ แล้วค่อยบันทึกไฟล์ใหม่เข้าไป
 * - รองรับคำสั่ง resetData เพื่อล้างชีตและล้างไฟล์ในไดรฟ์เป็นค่าเริ่มต้น
 * - รองรับคำสั่ง deleteUser และ deletePost พร้อมล้างไฟล์ที่เกี่ยวข้อง
 */

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ดึงรายการฟีดทั้งหมด
  if (action === 'getFeed') {
    var sheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
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

  // ดึงข้อมูลโปรไฟล์ผู้ใช้
  if (action === 'getProfile') {
    var uid = e.parameter.uid;
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Users sheet not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var uidIdx = headers.indexOf('uid');
    for (var i = 1; i < data.length; i++) {
      var rowUid = String(data[i][uidIdx] || '').replace(/^#/, '');
      if (rowUid === uid || data[i][uidIdx] === uid || data[i][uidIdx] === '#' + uid) {
        var profile = {};
        headers.forEach(function(h, idx) { profile[h] = data[i][idx]; });
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: profile }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'User not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันลบไฟล์ตามชื่อหรือคำขึ้นต้นชื่อ ทั้งในโฟลเดอร์และในไดรฟ์
function removeFilesByNameOrPrefix(folder, namePrefix) {
  if (!namePrefix) return;
  var extensions = ['', '.jpg', '.jpeg', '.png', '.webp', '.gif'];

  // 1. ค้นหาและลบใน DriveApp ตามชื่อไฟล์ที่ตรงกัน
  for (var i = 0; i < extensions.length; i++) {
    var targetName = namePrefix + extensions[i];
    try {
      var files = DriveApp.getFilesByName(targetName);
      while (files.hasNext()) {
        try { files.next().setTrashed(true); } catch(e) {}
      }
    } catch(e) {}
  }

  // 2. ค้นหาในโฟลเดอร์และลบทุกไฟล์ที่ขึ้นต้นด้วย namePrefix
  if (folder) {
    try {
      var fFiles = folder.getFiles();
      while (fFiles.hasNext()) {
        var f = fFiles.next();
        var fname = f.getName();
        if (fname.indexOf(namePrefix) === 0) {
          try { f.setTrashed(true); } catch(e) {}
        }
      }
    } catch(e) {}
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================
    // 1. UPDATE PROFILE & AUTO-DELETE OLD IMAGES
    // ==========================================
    if (action === 'updateProfile') {
      var usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) {
        usersSheet = ss.insertSheet('Users');
        usersSheet.appendRow(['uid', 'username', 'displayName', 'profileImage', 'updatedAt']);
      }

      var uid = String(data.uid || data.username || '').replace(/^#/, '');
      var profileImageUrl = data.profileImage || '';

      // หากมีการอัปโหลดรูปใหม่ (Base64)
      if (profileImageUrl && profileImageUrl.indexOf('data:image') === 0) {
        var folders = DriveApp.getFoldersByName('MTFeed_Profiles');
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('MTFeed_Profiles');

        // *** ขั้นตอนสำคัญ: ลบไฟล์ที่มีชื่อเหมือนกันเดิมออกก่อนเสมอ ***
        var baseName = 'profile_' + uid;
        removeFilesByNameOrPrefix(folder, baseName);
        if (data.username) {
          removeFilesByNameOrPrefix(folder, 'profile_' + data.username);
        }

        // ลบตาม file ID เดิมถ้าส่งมา
        if (data.oldFileId) {
          try { DriveApp.getFileById(data.oldFileId).setTrashed(true); } catch(err) {}
        }
        if (data.oldProfileImage) {
          var idMatch = String(data.oldProfileImage).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(data.oldProfileImage).match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            try { DriveApp.getFileById(idMatch[1]).setTrashed(true); } catch(err) {}
          }
        }

        // *** หลังจากลบไฟล์เดิมที่ชื่อเหมือนกันหมดแล้ว ค่อยส่งไฟล์ใหม่เข้าไป ***
        var contentType = profileImageUrl.substring(5, profileImageUrl.indexOf(';'));
        var base64Data = profileImageUrl.substring(profileImageUrl.indexOf(',') + 1);
        var bytes = Utilities.base64Decode(base64Data);
        var ext = contentType.indexOf('png') !== -1 ? '.png' : '.jpg';
        var newFileName = baseName + ext;
        var blob = Utilities.newBlob(bytes, contentType, newFileName);
        var newFile = folder.createFile(blob);
        newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        profileImageUrl = 'https://lh3.googleusercontent.com/d/' + newFile.getId();
      }

      // บันทึกหรืออัปเดตลง Sheet Users
      var uData = usersSheet.getDataRange().getValues();
      var uHeaders = uData[0];
      var uIdx = uHeaders.indexOf('uid');
      var userRow = -1;
      for (var j = 1; j < uData.length; j++) {
        var existingUid = String(uData[j][uIdx] || '').replace(/^#/, '');
        if (existingUid === uid) {
          userRow = j + 1;
          break;
        }
      }

      var rowValues = [uid, data.username || '', data.displayName || '', profileImageUrl, new Date().toISOString()];
      if (userRow > 0) {
        usersSheet.getRange(userRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        usersSheet.appendRow(rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        updatedProfile: true,
        profileImage: profileImageUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 2. DELETE PROFILE IMAGE ONLY
    // ==========================================
    if (action === 'deleteProfileImage') {
      var uid = String(data.uid || data.username || '').replace(/^#/, '');
      var profFolders = DriveApp.getFoldersByName('MTFeed_Profiles');
      var profFolder = profFolders.hasNext() ? profFolders.next() : null;
      removeFilesByNameOrPrefix(profFolder, 'profile_' + uid);
      if (data.username) {
        removeFilesByNameOrPrefix(profFolder, 'profile_' + data.username);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', deletedImage: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 3. DELETE USER (ลบทั้งใน Sheet และ Drive)
    // ==========================================
    if (action === 'deleteUser') {
      var usersSheet = ss.getSheetByName('Users');
      var uid = String(data.uid || data.username || '').replace(/^#/, '');
      if (usersSheet && uid) {
        var uData = usersSheet.getDataRange().getValues();
        var uHeaders = uData[0];
        var uIdx = uHeaders.indexOf('uid');
        for (var d = uData.length - 1; d >= 1; d--) {
          var rowUid = String(uData[d][uIdx] || '').replace(/^#/, '');
          if (rowUid === uid || uData[d][uIdx] === '#' + uid) {
            usersSheet.deleteRow(d + 1);
          }
        }
      }
      // ลบรูปโปรไฟล์ใน Drive
      var pFolders = DriveApp.getFoldersByName('MTFeed_Profiles');
      var pFolder = pFolders.hasNext() ? pFolders.next() : null;
      removeFilesByNameOrPrefix(pFolder, 'profile_' + uid);
      if (data.username) {
        removeFilesByNameOrPrefix(pFolder, 'profile_' + data.username);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', deletedUser: uid }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 4. CREATE POST
    // ==========================================
    if (action === 'createPost') {
      var feedSheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
      var imageUrl = data.image || '';
      var pdfUrl = data.pdf || '';

      if (imageUrl && imageUrl.indexOf('data:image') === 0) {
        var postFolders = DriveApp.getFoldersByName('MTFeed_Uploads');
        var pFolder = postFolders.hasNext() ? postFolders.next() : DriveApp.createFolder('MTFeed_Uploads');
        var imgType = imageUrl.substring(5, imageUrl.indexOf(';'));
        var imgBytes = Utilities.base64Decode(imageUrl.substring(imageUrl.indexOf(',') + 1));
        var imgBlob = Utilities.newBlob(imgBytes, imgType, 'post_' + Date.now() + '.jpg');
        var imgFile = pFolder.createFile(imgBlob);
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
    // 5. EDIT POST
    // ==========================================
    if (action === 'editPost') {
      var feedSheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
      var fData = feedSheet.getDataRange().getValues();
      for (var k = 1; k < fData.length; k++) {
        if (String(fData[k][0]) === String(data.postId)) {
          feedSheet.getRange(k + 1, 6).setValue(data.newContent);
          return ContentService.createTextOutput(JSON.stringify({ status: 'success', edited: true }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Post not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 6. DELETE POST (พร้อมลบรูปและ PDF ในไดรฟ์)
    // ==========================================
    if (action === 'deletePost') {
      var feedSheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
      var fData = feedSheet.getDataRange().getValues();
      for (var m = 1; m < fData.length; m++) {
        if (String(fData[m][0]) === String(data.postId)) {
          // ลบรูปโพสต์ใน Drive ถ้ามี
          var postImg = fData[m][6];
          if (postImg) {
            var mId = String(postImg).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(postImg).match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (mId && mId[1]) {
              try { DriveApp.getFileById(mId[1]).setTrashed(true); } catch(err) {}
            }
          }
          feedSheet.deleteRow(m + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: 'success', deleted: true, row: m + 1 }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', deleted: true, note: 'already removed' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 7. RESET DATA (ล้างข้อมูลทั้งชีตและไดรฟ์เป็นค่าเริ่มต้น)
    // ==========================================
    if (action === 'resetData' || action === 'resetAll') {
      // 1. ล้างไฟล์ในโฟลเดอร์ MTFeed_Profiles ทั้งหมด
      var profFolders = DriveApp.getFoldersByName('MTFeed_Profiles');
      while (profFolders.hasNext()) {
        var pFol = profFolders.next();
        var pFiles = pFol.getFiles();
        while (pFiles.hasNext()) {
          try { pFiles.next().setTrashed(true); } catch(e) {}
        }
      }

      // 2. ล้างไฟล์ในโฟลเดอร์ MTFeed_Uploads ทั้งหมด
      var upFolders = DriveApp.getFoldersByName('MTFeed_Uploads');
      while (upFolders.hasNext()) {
        var uFol = upFolders.next();
        var uFiles = uFol.getFiles();
        while (uFiles.hasNext()) {
          try { uFiles.next().setTrashed(true); } catch(e) {}
        }
      }

      // 3. ล้างชีต Feed ให้เหลือเฉพาะแถวหัวตาราง
      var feedSheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
      if (feedSheet) {
        var lastRow = feedSheet.getLastRow();
        if (lastRow > 1) {
          feedSheet.deleteRows(2, lastRow - 1);
        }
      }

      // 4. ล้างชีต Users ให้เหลือเฉพาะหัวตารางและแอดมินค่าเริ่มต้น MED68001
      var usersSheet = ss.getSheetByName('Users');
      if (usersSheet) {
        var lastUserRow = usersSheet.getLastRow();
        if (lastUserRow > 1) {
          usersSheet.deleteRows(2, lastUserRow - 1);
        }
        usersSheet.appendRow([
          'MED68001',
          '👑Admin',
          '👑 Admin',
          'https://lh3.googleusercontent.com/d/1ylD5QrEMSWIuWSNR4eHr6x9F4V5KZoe3',
          new Date().toISOString()
        ]);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        resetComplete: true,
        message: 'Drive folders and Google Sheets reset to default successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unsupported action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// ฟังก์ชันล้างข้อมูลทั้งหมด สามารถกดปุ่ม "เรียกใช้ (Run)" ได้โดยตรงใน Apps Script Editor!
// =========================================================================
function resetAllDataNow() {
  // 1. ล้างไฟล์ในโฟลเดอร์ MTFeed_Profiles
  var profFolders = DriveApp.getFoldersByName('MTFeed_Profiles');
  while (profFolders.hasNext()) {
    var pFol = profFolders.next();
    var pFiles = pFol.getFiles();
    while (pFiles.hasNext()) {
      try { pFiles.next().setTrashed(true); } catch(e) {}
    }
  }

  // 2. ล้างไฟล์ในโฟลเดอร์ MTFeed_Uploads
  var upFolders = DriveApp.getFoldersByName('MTFeed_Uploads');
  while (upFolders.hasNext()) {
    var uFol = upFolders.next();
    var uFiles = uFol.getFiles();
    while (uFiles.hasNext()) {
      try { uFiles.next().setTrashed(true); } catch(e) {}
    }
  }

  // 3. ล้างชีต Feed
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var feedSheet = ss.getSheetByName('Feed') || ss.getSheets()[0];
  if (feedSheet && feedSheet.getLastRow() > 1) {
    feedSheet.deleteRows(2, feedSheet.getLastRow() - 1);
  }

  // 4. ล้างชีต Users (เหลือเฉพาะหัวตารางและแอดมิน MED68001)
  var usersSheet = ss.getSheetByName('Users');
  if (usersSheet) {
    if (usersSheet.getLastRow() > 1) {
      usersSheet.deleteRows(2, usersSheet.getLastRow() - 1);
    }
    usersSheet.appendRow([
      'MED68001',
      '👑Admin',
      '👑 Admin',
      'https://lh3.googleusercontent.com/d/1ylD5QrEMSWIuWSNR4eHr6x9F4V5KZoe3',
      new Date().toISOString()
    ]);
  }
  Logger.log('✅ ล้างข้อมูล Google Drive และ Google Sheets ทั้งหมดกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
}
`;
