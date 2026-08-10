import {resolveValueArray} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";

/**
 *
 * @param actor {SWSEActor}
 */
export function getAvailableTrainedSkillCount(actor) {
    return actor.getCached("trained skills", () => {
        let intBonus = actor.system.abilities.int.mod
        let classBonus = 0;
        for (let co of actor.itemTypes.class) {
            if (co.levelsTaken.includes(1)) {
                classBonus = getInheritableAttribute({
                    entity: co,
                    attributeKey: "trainedSkillsFirstLevel",
                    reduce: "SUM"
                })
                break;
            }
        }
        let automaticTrainedSkill = getInheritableAttribute({
            entity: actor,
            attributeKey: "automaticTrainedSkill",
            reduce: "VALUES"
        }).length;
        let otherSkills = getInheritableAttribute({
            entity: actor,
            attributeKey: "trainedSkills",
            reduce: "SUM"
        });
        let availableTrainedSkillCount = Math.max(resolveValueArray([classBonus, intBonus, otherSkills, automaticTrainedSkill]), 0);
        const availableTrainedKnowledgeSkillCount = game.settings.get("swse", "lilLiteralistHomebrewBonusTrainedSkill");
        return {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount};
    })

}
