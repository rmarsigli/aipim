const inquirer = require('inquirer');
const ora = require('ora');
const { detectFramework } = require('../core/detector');
const { copyTemplates } = require('../core/installer');