#include <Arduino.h>
#include <robocek.h>

const int SPEED = 120;
const int TURN_SPEED = 100;

const float OBSTACLE_DISTANCE = 20.0;

void setup()
{
    Serial.begin(115200);

    RC::begin();
}

void loop()
{
    auto distance = RC::Ultrasonic.read();

    bool leftBlocked =
        distance.left > 0 &&
        distance.left < OBSTACLE_DISTANCE;

    bool rightBlocked =
        distance.right > 0 &&
        distance.right < OBSTACLE_DISTANCE;

    if (!leftBlocked && !rightBlocked)
    {
        RC::Motor.forward(SPEED);
    }
    else if (leftBlocked && !rightBlocked)
    {
        // Obstacle left -> turn right
        RC::Motor.right(TURN_SPEED);
    }
    else if (!leftBlocked && rightBlocked)
    {
        // Obstacle right -> turn left
        RC::Motor.left(TURN_SPEED);
    }
    else
    {
        // Both blocked
        RC::Motor.backward(SPEED);

        delay(300);

        RC::Motor.right(TURN_SPEED);

        delay(300);
    }

    delay(50);
}