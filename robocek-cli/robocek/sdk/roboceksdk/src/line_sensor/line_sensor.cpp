#include "line_sensor.h"
#include "robocek_config.h"

namespace RC {

void LineSensorController::begin()
{
    pinMode(RC_LINE_SENSOR_LEFT, INPUT);
    pinMode(RC_LINE_SENSOR_RIGHT, INPUT);

    _leftPin = RC_LINE_SENSOR_LEFT;
    _rightPin = RC_LINE_SENSOR_RIGHT;
}

bool LineSensorController::isLeftDetected()
{
    return digitalRead(_leftPin) == RC_LINE_SENSOR_ACTIVE;
}

bool LineSensorController::isRightDetected()
{
    return digitalRead(_rightPin) == RC_LINE_SENSOR_ACTIVE;
}

LineSensorController LineSensor;

}