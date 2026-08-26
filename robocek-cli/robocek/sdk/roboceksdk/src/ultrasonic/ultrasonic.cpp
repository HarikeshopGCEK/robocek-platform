#include "ultrasonic.h"
#include "robocek_config.h"

namespace RC {

static constexpr unsigned long ECHO_TIMEOUT_US = 30000UL;

void UltrasonicController::begin()
{
	_leftTrig = RC_ULTRASONIC_LEFT_TRIGGER;
	_leftEcho = RC_ULTRASONIC_LEFT_ECHO;
	_rightTrig = RC_ULTRASONIC_RIGHT_TRIGGER;
	_rightEcho = RC_ULTRASONIC_RIGHT_ECHO;

	pinMode(_leftTrig, OUTPUT);
	pinMode(_leftEcho, INPUT);
	pinMode(_rightTrig, OUTPUT);
	pinMode(_rightEcho, INPUT);

	digitalWrite(_leftTrig, LOW);
	digitalWrite(_rightTrig, LOW);
}

UltrasonicDistance UltrasonicController::read()
{
	return {
		readSensor(_leftTrig, _leftEcho),
		readSensor(_rightTrig, _rightEcho)
	};
}

float UltrasonicController::readSensor(
	uint8_t trigPin,
	uint8_t echoPin
)
{
	digitalWrite(trigPin, LOW);
	delayMicroseconds(2);
	digitalWrite(trigPin, HIGH);
	delayMicroseconds(10);
	digitalWrite(trigPin, LOW);

	unsigned long duration = pulseIn(
		echoPin,
		HIGH,
		ECHO_TIMEOUT_US
	);

	return duration / 58.0f;
}

UltrasonicController Ultrasonic;

}
