import { openInteractivePrompt } from './tool/interactivePrompt';
import * as bots from './bots/importBots';
import { readArgs } from './tool/commandMode';
import * as cluster from 'cluster';
import { TournamentManager } from './tool/tournamentManager';
import { TournamentWorker } from './tool/tournamentWorker';

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => {
    throw up;
});

if (cluster.isMaster) {
    const numWorkers = require('os').cpus().length - 1;
    const manager = TournamentManager.getInstance();

    console.warn('create', numWorkers, 'workers');
    for (let i = 0; i < numWorkers; i++) {
        manager.createWorker();
    }

    if (process.argv.length <= 2) {
        openInteractivePrompt();
    } else {
        readArgs();
    }
} else {
    // tslint:disable-next-line:no-unused-expression
    new TournamentWorker();
}

const importBotz = bots;
