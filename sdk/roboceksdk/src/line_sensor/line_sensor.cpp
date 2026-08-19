#include "line_sensor.h"

namespace RC {
    LineSensor::LineSensor(int leftPin, int rightPin) : _leftPin(leftPin), _rightPin(rightPin) {}

    void LineSensor::begin() {
        pinMode(_leftPin, INPUT);
        pinMode(_rightPin, INPUT);
    }

    bool LineSensor::isLeftDetected() {
        return digitalRead(_leftPin) == HIGH;
    }

    bool LineSensor::isRightDetected() {
        return digitalRead(_rightPin) == HIGH;
    }
}

RC::LineSensor RC::LineSensorInstance(RC_LINE_SENSOR_LEFT, RC_LINE_SENSOR_RIGHT);