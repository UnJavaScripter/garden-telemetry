#include <Adafruit_CCS811.h>
#include <Adafruit_AHTX0.h>

Adafruit_AHTX0 aht;
Adafruit_CCS811 ccs;

// int env_sensors_period = 20000;
// int ground_sensors_period = 3600000000; // 1h
int interval_env_sensors = 30000;
int interval_ground_sensors = 3600000000; // 1h
unsigned long time_env_sensors = 0;
unsigned long time_ground_sensors = 0;

// Humidity
int moistureSensorPin_1 = A0;
int moistureSensorPin_2 = A1;
int moistureSensorPin_3 = A2;
int moistureSensorPin_4 = A3;

// Irrigation
int WaterPumpRelay_1 = 8;
int WaterPumpRelay_2 = 7;
int WaterPumpRelay_3 = 6;
int WaterPumpRelay_4 = 5;

// Serial input
byte incomingByte[2];


void setup()
{
  Serial.begin(9600);

  pinMode(WaterPumpRelay_1, OUTPUT);
  pinMode(WaterPumpRelay_2, OUTPUT);
  pinMode(WaterPumpRelay_3, OUTPUT);
  pinMode(WaterPumpRelay_4, OUTPUT);

  // Sensors setup
  if (!ccs.begin())
  {
    Serial.println("Failed to start sensor! Please check your wiring.");
    while (1)
      ;
  }

  if (!aht.begin())
  {
    Serial.println("Could not find AHT? Check wiring");
    while (1)
      delay(10);
  }

  // Wait for the sensor to be ready
  while (!ccs.available())
    ;

}

void loop() {
  unsigned long currentMillis = millis();

  // Irrigation
  if (Serial.available() > 0) {
    Serial.readBytes(incomingByte, 2);
    if (incomingByte == 10) {
      return;
    }
    if(incomingByte[0] == 105 && incomingByte[1] >= 49 && incomingByte[1] <=52) {
      handleIrrigation(incomingByte[1]);
    }
  }

  // Sensors

  if((unsigned long)(currentMillis - time_env_sensors) >= interval_env_sensors){
    time_env_sensors = currentMillis;
    getEnvSensors();
  }
  // if((unsigned long)(currentMillis - time_ground_sensors) >= interval_ground_sensors){
  //   time_ground_sensors = currentMillis;
  //   getGroundSensors();
  // }
}

void getEnvSensors()
{
  sensors_event_t humidity, temp;
  aht.getEvent(&humidity, &temp);
  if (ccs.available())
  {
    if (!ccs.readData())
    {
      if (ccs.geteCO2() > 0)
      {
        Serial.print("{");
          Serial.print("\"gardenId\":");
          Serial.print("\"garden1\"");
          Serial.print(",");
          Serial.print("\"sensorsType\":");
          Serial.print("\"live_env_sensors\"");
          Serial.print(",");
          Serial.print("\"data\":");
          Serial.print("{");
            Serial.print("\"co2\":");
            Serial.print(ccs.geteCO2());
            Serial.print(",");
            Serial.print("\"tvoc\":");
            Serial.print(ccs.getTVOC());
            Serial.print(",");
            Serial.print("\"temperature\":");
            Serial.print(temp.temperature);
            Serial.print(",");
            Serial.print("\"humidity\":");
            Serial.print(humidity.relative_humidity);
          Serial.print("}");
        Serial.print("}");
        Serial.println("");
      }
    } else{
      Serial.println("{\"error\": \"couldn not read ccs data\"}");
    }
  }
}

void getGroundSensors() {
  int soilMoistureSensor1 = analogRead(moistureSensorPin_1);
  int soilMoistureSensor2 = analogRead(moistureSensorPin_2);
  int soilMoistureSensor3 = analogRead(moistureSensorPin_3);
  int soilMoistureSensor4 = analogRead(moistureSensorPin_4);
  Serial.print("{");
    Serial.print("\"gardenId\":");
    Serial.print("\"garden1\"");
    Serial.print(",");
    Serial.print("\"sensorsType\":");
    Serial.print("\"live_ground_sensors\"");
    Serial.print(",");
    Serial.print("\"data\":");
    Serial.print("{");
      Serial.print("\"soilMoisture_1\":");
      Serial.print(convertToPercent(soilMoistureSensor1));
      Serial.print(",");
      Serial.print("\"soilMoisture_2\":");
      Serial.print(convertToPercent(soilMoistureSensor2));
      Serial.print(",");
      Serial.print("\"soilMoisture_3\":");
      Serial.print(convertToPercent(soilMoistureSensor3));
      Serial.print(",");
      Serial.print("\"soilMoisture_4\":");
      Serial.print(convertToPercent(soilMoistureSensor4));
      Serial.print(",");
    Serial.print("}");
  Serial.print("}");
}

// int convertToPercent(int value)
// {
//   int percentValue = 0;
//   percentValue = map(value, 1023, 255, 0, 100);
//   return percentValue;
// }
int convertToPercent(int value)
{
  return (value * 100 / 255);
}


void handleIrrigation(int relayNumber) {
  switch (relayNumber) {
    case 49:
      activateIrrigationRelay(WaterPumpRelay_1);
      break;
    case 50:
      activateIrrigationRelay(WaterPumpRelay_2);
      break;
    case 51:
      activateIrrigationRelay(WaterPumpRelay_3);
      break;
    case 52:
      activateIrrigationRelay(WaterPumpRelay_4);
      break;
  }
}

void activateIrrigationRelay(int RelayPin) {
  digitalWrite(RelayPin, HIGH);
  delay(3000);
  digitalWrite(RelayPin, LOW);
  delay(500);
  Serial.print("Irrigated: ");
  Serial.print(RelayPin);
  Serial.println("");
}
