import { AutoBalancer } from "./autoBalancer";
import { CardType } from "./game_model/card";
import { UnitData } from "./game_model/cards/cardList";
import { decapitate } from "./game_model/cards/decayCards";
import { allDecks } from "./game_model/scenarios/decks";
import { UnitType } from "./game_model/unit";

const balancer = new AutoBalancer();

let cData: UnitData = {
    cardType: CardType.Unit, 
    type: UnitType.Human,
    cost: {energy: 1},
    life: 10,
    damage: 10,
    id: 'test-card',
    name: 'Test Card',
    imageUrl: '',
    targeter: {id: 'Untargeted', optional: false},
    mechanics: []
};

balancer.balanceCard(cData, decapitate(), allDecks, 0.1, 1).then(balanced => {
    console.log('res', balanced);
});
