import * as fs from 'fs';
import { AI } from '../game_model/ai/ai';
import { AIConstructor } from '../game_model/ai/aiList';
import { DefaultAI } from '../game_model/ai/defaultAi';
import { Animator } from '../game_model/animator';
import { ClientGame } from '../game_model/clientGame';
import { DeckList, SavedDeck } from '../game_model/deckList';
import { GameAction, GameActionType } from '../game_model/events/gameAction';
import { GameSyncEvent, SyncEventType } from '../game_model/events/syncEvent';
import { standardFormat } from '../game_model/gameFormat';
import { ServerGame } from '../game_model/serverGame';

export interface GameInfo {
    readonly ai1: string;
    readonly ai2: string;
    readonly deck1: SavedDeck;
    readonly deck2: SavedDeck;
    readonly playerNumbers: number[];
}

export class GameManager {
    private game1: ClientGame | null = null;
    private game2: ClientGame | null = null;
    private gameModel: ServerGame | null = null;

    private ais: Array<AI> = [];
    private seed = 0;
    public annoucmentsOn = true;
    public exitOnFailure = true;

    public onGameEnd: (winner: number) => any = () => null;

    constructor() {
        this.reset();
    }

    public reset() {
        this.stopAI();
        this.game1 = null;
        this.game2 = null;
        this.gameModel = null;
        this.ais = [];
    }

    private stopAI() {
        for (const ai of this.ais) {
            ai.stopActing();
        }
    }

    public startAiInDelayMode(ms: number, animator: Animator) {
        for (const ai of this.ais) {
            ai.startActingDelayMode(ms, animator);
        }
    }

    public startAiInImmediateMode() {
        for (const ai of this.ais) {
            ai.startActingImmediateMode();
        }
    }

    // Action communication -------------------------------------
    private sendEventsToLocalPlayers(events: GameSyncEvent[]) {
        setTimeout(() => {
            for (const event of events) {
                for (const ai of this.ais) {
                    try {
                        ai.handleGameEvent(event);
                    } catch (error) {
                        console.error('Failure while sending events to A.Is');
                        console.error(error);
                        this.onFailure();
                    }
                }
                this.watchGame(event);
            }
        }, 1);
    }

    private checkPriorityChange(event: GameSyncEvent) {
        if (!this.gameModel) {
            throw new Error('Gamee not initlized properly');
        }
        if (!this.gameModel.canTakeAction()) {
            return;
        }
        if (
            event.type === SyncEventType.TurnStart ||
            event.type === SyncEventType.PhaseChange ||
            event.type === SyncEventType.ChoiceMade
        ) {
            this.ais[this.gameModel.getActivePlayer()].onGainPriority();
        }
    }

    private watchGame(event: GameSyncEvent) {
        if (event.type === SyncEventType.Ended) {
            this.endGame(event.winner);
        } else if (
            this.annoucmentsOn &&
            event.type === SyncEventType.TurnStart &&
            this.gameModel
        ) {
            console.log(
                `Turn ${event.turnNum} Life Totals ${this.gameModel
                    .getPlayer(0)
                    .getLife()} to ${this.gameModel.getPlayer(1).getLife()}.`
            );
        }

        if (this.gameModel) {
            this.checkPriorityChange(event);
        }
    }

    private sendGameAction(action: GameAction) {
        if (!this.gameModel || !this.game1 || !this.game2) {
            throw new Error('Gamee not initlized properly');
        }
        const res = this.gameModel.handleAction(action);

        if (res === null) {
            console.error(
                'An action sent to game model by',
                action.player,
                'failed. It was',
                GameActionType[action.type],
                'with',
                action
            );

            this.onFailure();

            return;
        }
        this.sendEventsToLocalPlayers(res);
    }

    public isInputEnabled() {
        return this.ais.length < 2;
    }

    // Game Life cycle ------------------------------------------------

    /** Invoked when the game ends (because a player won) */
    private endGame(winner: number) {
        if (this.annoucmentsOn) {
            console.log(`A.I ${winner} won the game`);
        }
        this.reset();
        this.onGameEnd(winner);
    }

    /** Executed when a game raises an error. Must execute some kind of policy to recover or exit. */
    public onFailure() {
        if (this.exitOnFailure) {
            this.saveSeed(this.seed);
            process.exit(1);
        } else {
            this.endGame(NaN);
        }
    }

    private loadOrGenerateSeed(): number {
        if (this.exitOnFailure && fs.existsSync('seedfile')) {
            const savedSeed = parseInt(
                fs.readFileSync('seedfile').toString(),
                10
            );
            console.warn('Using saved seed', savedSeed);
            return savedSeed;
        }
        return new Date().getTime();
    }

    private saveSeed(seed: number) {
        fs.writeFileSync('seedfile', seed);
    }

    public startAIGame(
        ai1: AIConstructor = DefaultAI,
        ai2: AIConstructor = DefaultAI,
        deck1: DeckList,
        deck2: DeckList
    ) {
        this.seed = this.loadOrGenerateSeed();
        ServerGame.setSeed(this.seed);

        const animator = new Animator(0.0001);

        if (this.annoucmentsOn) {
            console.log('Start game with seed', this.seed);
            console.log(
                `${ai1.name} with deck ${deck1.name} vs ${ai2.name} with deck ${
                    deck2.name
                }`
            );
        }

        // Initialize games
        this.gameModel = new ServerGame('server', standardFormat, [
            deck1,
            deck2
        ]);
        this.game1 = new ClientGame(
            'A.I - 1',
            (_, action) => this.sendGameAction(action),
            animator
        );
        this.game2 = new ClientGame(
            'A.I - 2',
            (_, action) => this.sendGameAction(action),
            animator
        );

        this.ais.push(new ai1(0, this.game1, deck1));
        this.ais.push(new ai2(1, this.game2, deck2));
        this.sendEventsToLocalPlayers(this.gameModel.startGame());
        this.startAiInDelayMode(1, animator);
    }
}
