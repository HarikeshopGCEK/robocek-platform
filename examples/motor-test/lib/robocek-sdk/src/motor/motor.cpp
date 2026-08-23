#include "motor.h"
#include "robocek_config.h"

namespace RC {

static constexpr int LEFT_PWM = RC_LEFT_PWM;
static constexpr int LEFT_IN1 = RC_LEFT_IN1;
static constexpr int LEFT_IN2 = RC_LEFT_IN2;

static constexpr int RIGHT_PWM = RC_RIGHT_PWM;
static constexpr int RIGHT_IN1 = RC_RIGHT_IN1;
static constexpr int RIGHT_IN2 = RC_RIGHT_IN2;

static constexpr int LEFT_CHANNEL = 0;
static constexpr int RIGHT_CHANNEL = 1;

static constexpr int PWM_FREQUENCY = 1000;
static constexpr int PWM_RESOLUTION = 8;

MotorController Motor;

void MotorController::begin() {

    pinMode(RC_MOTOR_STBY, OUTPUT);
    digitalWrite(RC_MOTOR_STBY, HIGH);

    pinMode(LEFT_IN1, OUTPUT);
    pinMode(LEFT_IN2, OUTPUT);

    pinMode(RIGHT_IN1, OUTPUT);
    pinMode(RIGHT_IN2, OUTPUT);

    ledcSetup(
        LEFT_CHANNEL,
        PWM_FREQUENCY,
        PWM_RESOLUTION
    );

    ledcSetup(
        RIGHT_CHANNEL,
        PWM_FREQUENCY,
        PWM_RESOLUTION
    );

    ledcAttachPin(LEFT_PWM, LEFT_CHANNEL);
    ledcAttachPin(RIGHT_PWM, RIGHT_CHANNEL);

    stop();
}

void MotorController::left(int speed) {

    speed = constrain(speed, 0, 255);

    digitalWrite(LEFT_IN1, LOW);
    digitalWrite(LEFT_IN2, HIGH);

    digitalWrite(RIGHT_IN1, HIGH);
    digitalWrite(RIGHT_IN2, LOW);

    ledcWrite(LEFT_CHANNEL, speed);
    ledcWrite(RIGHT_CHANNEL, speed);
}

void MotorController::right(int speed) {

    speed = constrain(speed, 0, 255);

    digitalWrite(LEFT_IN1, HIGH);
    digitalWrite(LEFT_IN2, LOW);

    digitalWrite(RIGHT_IN1, LOW);
    digitalWrite(RIGHT_IN2, HIGH);

    ledcWrite(LEFT_CHANNEL, speed);
    ledcWrite(RIGHT_CHANNEL, speed);
}

void MotorController::forward(int speed) {

    speed = constrain(speed, 0, 255);

    digitalWrite(LEFT_IN1, HIGH);
    digitalWrite(LEFT_IN2, LOW);

    digitalWrite(RIGHT_IN1, HIGH);
    digitalWrite(RIGHT_IN2, LOW);

    ledcWrite(LEFT_CHANNEL, speed);
    ledcWrite(RIGHT_CHANNEL, speed);
}

void MotorController::backward(int speed) {

    speed = constrain(speed, 0, 255);

    digitalWrite(LEFT_IN1, LOW);
    digitalWrite(LEFT_IN2, HIGH);

    digitalWrite(RIGHT_IN1, LOW);
    digitalWrite(RIGHT_IN2, HIGH);

    ledcWrite(LEFT_CHANNEL, speed);
    ledcWrite(RIGHT_CHANNEL, speed);
}

void MotorController::stop() {

    ledcWrite(LEFT_CHANNEL, 0);
    ledcWrite(RIGHT_CHANNEL, 0);

    digitalWrite(LEFT_IN1, LOW);
    digitalWrite(LEFT_IN2, LOW);

    digitalWrite(RIGHT_IN1, LOW);
    digitalWrite(RIGHT_IN2, LOW);
}

}