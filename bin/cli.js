#!/usr/bin/env node
require('../src/index.js');

const { Command } = require('commander');
const { install } = require('../src/commands/install');
const { update } = require('../src/commands/update');