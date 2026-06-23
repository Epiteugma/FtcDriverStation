# FTC Driver Station for PC

This is a desktop version of the driver station app used for FIRST Tech Challenge to control a robot.
It can be used without installation of any additional software on the robot, as it uses the same protocol as the mobile driver station app does.

![Preview](.gitimages/app-preview.png)

## Developing the app

Prerequisites: you must have [NodeJS](https://nodejs.org/ens) installed

- Clone the repository with `--recurse-submodules`
- Run `npm install` to download project dependencies
- Run `npm run build` to build the app
- Start the app using `npm start`

## Keyboard controller

If a hardware gamepad is not available, the app can send a synthetic gamepad from the keyboard.
Use the `K1` or `K2` button in the status bar to assign the keyboard to driver slot 1 or 2.

| Gamepad input | Keyboard input |
| --- | --- |
| Left stick | `W`, `A`, `S`, `D` |
| Right stick | Arrow keys |
| A / B / X / Y | `Space`, `B`, `X`, `Y` |
| Left / right bumper | `Q`, `E` |
| Left / right trigger | `Z`, `C` |
| Start / back | `Enter`, `Backspace` |
| Left / right stick button | `Shift`, `Control` |
| D-pad | `I`, `J`, `K`, `L` |
