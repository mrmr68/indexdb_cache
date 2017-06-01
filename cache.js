function getTableName () {
  var date = new Date(),
    year = date.getFullYear().toString(),
    month = (date.getMonth() + 1).toString(),
    day = date.getDate().toString();
  if (month.length == 1) {
    month = "0" + month;
  }
  if (day.length == 1) {
    day = "0" + day;
  }
  return year + month + day;
}

function cache (mode, key, value) {
  var defer = $.Deferred();
  var tableName = getTableName();
  // این قطعه کد جهت پشتیبانی همه مرورگرها از کش indexDB می باشد.
  var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;

// باز کردن (یا ساختن در صورت عدم وجود) پایگاه داده رسام با نسخه 3 indexDB
  var open = indexedDB.open("RasamDB", 3);

// ایجاد جدول رسام در پایگاه داده رسام در صورت عدم وجود
  open.onupgradeneeded = function () {
    var db = open.result;
    db.createObjectStore(tableName, { keyPath: "key" });
  };

  // شروع یک تراکنش جدید
  open.onsuccess = function () {
    var db = open.result;
    var objectStores = db.objectStoreNames;
    var founded = false;
    for (var i = 0; i < objectStores.length; i++) {
      if (objectStores[ i ] == tableName) {
        founded = true;
      }
    }
    if (!founded) {
      indexedDB.deleteDatabase("RasamDB");
      db.close();
      cache(mode, key, value)
        .then(function (res) {
          defer.resolve(res);
        })
        .fail(function (err) {
          defer.reject(err);
        });
    }
    else {
      var tx = db.transaction(tableName, "readwrite");

      var store = tx.objectStore(tableName);

      if (mode == "set") { // تراکنش ذخیره سازی
        var setData = store.put({ key: key, value: value });
        setData.onsuccess = function () {
          defer.resolve("Status OK");
        };
        setData.onerror = function (event) {
          defer.reject("setting error: " + event.target.errorCode);
        };
      }
      else { // تراکنش دریافت
        var getData = store.get(key);
        getData.onsuccess = function () {
          if (getData.result) {
            defer.resolve(getData.result.value);
          }
          else {
            defer.reject(null);
          }
        };
        getData.onerror = function (event) {
          defer.reject("getting error: " + event.target.errorCode);
        };
      }

      // بستن پایگاه داده در صورتی که تراکنش با موفقیت انجام شود
      tx.oncomplete = function () {
        db.close();
      };

      // بستن پایگاه داده در صورتی که تراکنش با موفقیت انجام شود
      tx.onerror = function () {
        db.close();
      };
    }

  };
  open.onerror = function (event) {
    defer.reject("dataBase error: " + event.target.errorCode);
  };
  return defer.promise();
}

function setCache (key, value) {
  return cache("set", key, value);
}

function getCache (key) {
  var defer = $.Deferred();
  // درخواست آخرین زمان محاسبات از سرور
  $.ajax({
      url: 'app/rasam/lastTimeUpdate',
      method: 'GET'
    })
    .done(function (serverLastTimeUpdate) {
      // درخواست آخرین زمان محاسبات از کش
      cache("get", 'lastTimeUpdate')
        .then(function (cacheLastTimeUpdate) {
          if (cacheLastTimeUpdate === serverLastTimeUpdate) {
            // در صورتی که زمان محاسبات کش با زمان محاسبات سرور یکسان باشد
            cache("get", key)
              .then(function (data) {
                defer.resolve(data);
              })
              .fail(function (error) {
                defer.reject(error);
              });
          }
          else {
            // در صورتی که در طول روز زمان آخرین محاسبات سرور تغییر کند، از آنجائی که دیگر آن زمان با زمان محاسبات کش یکسان نیست. کل کش پاک شده و زمان جدید محاسبات در کش ریخته می شود.
            var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
            indexedDB.deleteDatabase("RasamDB");
            setCache('lastTimeUpdate', serverLastTimeUpdate)
              .done(function () {
                defer.reject(null);
              });
          }
        })
        .fail(function () {
          // برای درخواست اول در روز که هنوز زمان محاسبات در کش نیست
          var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
          indexedDB.deleteDatabase("RasamDB");
          setCache('lastTimeUpdate', serverLastTimeUpdate)
            .done(function () {
              cache("get", key)
                .then(function (data) {
                  defer.resolve(data);
                })
                .fail(function (error) {
                  defer.reject(error);
                });
            })
        });
    })
    .fail(function () {
      // در صورتی که زمان محاسبات از سرور برگردانده نشود و با خطای دیتابیس برخورد کند
      cache("get", key)
        .then(function (data) {
          defer.resolve(data);
        })
        .fail(function (error) {
          defer.reject(error);
        });
    });
  return defer.promise();
}