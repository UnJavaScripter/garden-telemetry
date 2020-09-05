const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require('./service-acct.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const liveEnvSensorsDataSize = 10;
const liveGroundSensorsDataSize = 10;

exports.status = functions.https.onRequest(async (request, response) => {
  const docId = 'garden1';
  const ref = db.doc(`latest/${docId}/`);
  const dataObj = await ref.get();
  return response.json(await dataObj.data().latest);
});

exports.assistant = functions.https.onRequest(async (request, response) => {
  if(request.method !== "POST"){
    return;
  }
  const docId = 'garden1';
  const ref = db.doc(`latest/${docId}/`);
  const data = await ref.get();
  const temperature = await data.data().latest.temperature;
  const humidity = await data.data().latest.humidity;
  const co2 = await data.data().latest.co2;
  return response.json({
    "payload": {
      "google": {
        "expectUserResponse": false,
        "richResponse": {
          "items": [
            {
              "simpleResponse": {
                "textToSpeech": `The current garden temperature is ${Number(temperature).toFixed(2)} degrees, humidity is ${Number(humidity).toFixed(2)}% and CO2 concentration is ${Number(co2).toFixed(0)} %`
              }
            }
          ]
        }
      }
    }
  })
});

exports.writeSensorData = functions.firestore
  .document('gardens/{gardenId}')
  .onWrite(async (change, context) => {
    const docId = context.params.gardenId;
    const newValue = await change.after.data();
    if (newValue) {
      if (newValue.hasOwnProperty('live_env_sensors')) {
        const doc = db.doc(`latest/${docId}/`);
        const latestData = await newValue.live_env_sensors.slice(-1)[0];
        console.log(latestData)
        doc.set({
          latest: Object.assign(latestData, {dateStr: new Date().toLocaleString("en-NL", {timeZone: "Europe/Amsterdam"}) } )
        });
        if (newValue.live_env_sensors.length > liveEnvSensorsDataSize && newValue.live_env_sensors.length % liveEnvSensorsDataSize === 0) {
          console.log('live ENV!!!!!!!!!!!!!!!!!')
          const sensorKeys = ['temperature', 'humidity', 'co2', 'tvoc'];
          archive(docId, newValue.live_env_sensors, 'live_env_sensors', sensorKeys, liveEnvSensorsDataSize);
        }
      }
      if (newValue.hasOwnProperty('live_ground_sensors')) {
        if (newValue.live_ground_sensors.length > liveGroundSensorsDataSize && newValue.live_ground_sensors.length % liveGroundSensorsDataSize === 0) {
          const sensorKeys = ['moisture'];
          archive(docId, newValue.live_ground_sensors, 'live_ground_sensors', sensorKeys, liveGroundSensorsDataSize);
        }
      }
    }
    return newValue;
  });

async function archive(docId, newData, dataKey, sensorKeys, recordsAmount) {
  console.log('========================== Archiving ==========================');
  let dateMark;
  let sensorKeysObject = {};

  for (let i = 0; i < sensorKeys.length; i++) {
    sensorKeysObject[sensorKeys[i]] = {};
  }
  const groupedData = newData.reduce((acc, elem) => {
    dateMark = getDateStr(new Date(elem.date));
    if (!acc) {
      acc = {};
    }
    if (!acc[dateMark]) {
      acc[dateMark] = sensorKeysObject;
    }

    // record count

    acc[dateMark].date = elem.date;

    // temperature:
    // -> min
    for (key of sensorKeys) {
      if (!acc[dateMark][key].min) {
        acc[dateMark][key].min = elem[key];
      } else {
        acc[dateMark][key].min = Math.min(elem[key], acc[dateMark][key].min);
      }
      // -> max
      if (!acc[dateMark][key].max) {
        acc[dateMark][key].max = elem[key];
      } else {
        acc[dateMark][key].max = Math.max(elem[key], acc[dateMark][key].max);
      }
      // -> count of elements
      if(!acc[dateMark][key].count) {
        acc[dateMark][key].count = 0;
      }
      acc[dateMark][key].count += 1;
      // -> accumulated value
      if(!acc[dateMark][key].sum) {
        acc[dateMark][key].sum = 0;
      }
      acc[dateMark][key].sum += elem[key];
    }

    return acc;
  }, {});
  let archiveDate;
  let doc;

  for (let dataPeriodGroup in groupedData) {
    archiveDate = getDateStr(new Date(groupedData[dataPeriodGroup].date));
    doc = db.doc(`gardens/${docId}/archive/${archiveDate}`);
    let updateObj = {};

    for (let i = 0; i < sensorKeys.length; i++) {
      updateObj[sensorKeys[i]] = {
        max: groupedData[dataPeriodGroup][sensorKeys[i]].max,
        min: groupedData[dataPeriodGroup][sensorKeys[i]].min,
        average: groupedData[dataPeriodGroup][sensorKeys[i]].sum / groupedData[dataPeriodGroup][sensorKeys[i]].count,
        date: groupedData[dataPeriodGroup].date,
        dateStr: new Date(groupedData[dataPeriodGroup].date)
      }
    }

    doc.set({
      [dataKey]: admin.firestore.FieldValue.arrayUnion(updateObj)
    }, {merge: true});
  }
  if (newData.length > recordsAmount) {
    return deleteOldLiveData(dataKey, docId, newData);
  }
}

async function deleteOldLiveData(liveDataArrKey, docId, recordsToDelete) {
  console.log(`========================== Cleaning old: ${liveDataArrKey} ==========================`);
  const doc = db.doc(`gardens/${docId}`);

  doc.update({
    [liveDataArrKey]: admin.firestore.FieldValue.arrayRemove(...recordsToDelete)
  });
}

function getDateStr(date) {
  return `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${date.getUTCFullYear()} ${date.getUTCHours()}:00`;
}


// exports.updateSensorData = functions.firestore
//   .document('gardens/{gardenId}')
//   .onUpdate((change, context) => {
//     console.log('Update')
//    });
// exports.deleteSensorData = functions.firestore
//   .document('gardens/{gardenId}')
//   .onDelete((change, context) => {
//     console.log('Delete')
//   });
