import Phaser from "phaser";
import { createGameConfig } from "./game/config";
import { installLandscapeModePrompt } from "./platform/OrientationLock";
import "./styles.css";

installLandscapeModePrompt();
new Phaser.Game(createGameConfig());
