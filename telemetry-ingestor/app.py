import http.client
import json
import time

import board
import busio
import adafruit_ahtx0
import adafruit_ccs811

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Use a service account
cred = credentials.Certificate(
    '/home/pi/code/get-send-sensor-data/garden-data-1d047-firebase-adminsdk-plie8-0356ee7d53.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

doc_ref = db.collection(u'gardens').document(u'garden1')

# Create library object using our Bus I2C port
i2c = busio.I2C(board.SCL, board.SDA)
aht10 = adafruit_ahtx0.AHTx0(i2c)
ccs811 = adafruit_ccs811.CCS811(i2c)

time.sleep(5)

while True:
    temp = aht10.temperature
    hum = aht10.relative_humidity
    co2 = ccs811.eco2
    tvoc = ccs811.tvoc
    dateRecorded = time.time() *1000
    doc_ref.update({u'live_env_sensors': firestore.ArrayUnion([
        {u'temperature': temp,
         u'humidity': hum,
         u'co2': co2,
         u'tvoc': tvoc,
         u'date': dateRecorded}
    ])
    })
    print(dateRecorded, ': Temperature ', temp, ' °C. Humidity ', hum, '%. CO2', co2, '% TVOC ', tvoc, ' PPM')

    time.sleep(60)
