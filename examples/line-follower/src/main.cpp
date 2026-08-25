#include <Arduino.h>
#include <robocek.h>

const int BASE_SPEED = 140;
const int TURN_SPEED = 70;

void setup()
{
    Serial.begin(115200);

    delay(500);

    Serial.println();
    Serial.println("==============================");
    Serial.println("     ROBOCEK LINE FOLLOWER");
    Serial.println("==============================");

    RC::begin();
}

void loop()
{
    bool left = RC::LineSensor.isLeftDetected();
    bool right = RC::LineSensor.isRightDetected();

    /*
        Sensor states:

        Left  Right
          0     0  -> No line
          0     1  -> Line on right
          1     0  -> Line on left
          1     1  -> Both on line
    */

    if (!left && !right)
    {
        // No line detected.
        // For the first version, keep moving forward.
        RC::Motor.forward(BASE_SPEED);
    }
    else if (!left && right)
    {
        // Line is on the right — steer right.
        RC::Motor.right(TURN_SPEED);
    }
    else if (left && !right)
    {
        // Line is on the left — steer left.
        RC::Motor.left(TURN_SPEED);
    }
    else
    {
        // Both sensors detect the line.
        // Treat it as straight for now.
        RC::Motor.forward(BASE_SPEED);
    }

    delay(10);
}