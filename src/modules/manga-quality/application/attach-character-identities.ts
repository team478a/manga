import type { CharacterIdentity } from "../domain/character-identity.ts";
import {
  panelSpecificationSchema,
  type PanelSpecification,
} from "../domain/panel-specification.ts";

export function attachCharacterIdentities(
  specification: PanelSpecification,
  identities: readonly CharacterIdentity[],
) {
  return panelSpecificationSchema.parse({
    ...specification,
    characterIdentities: Array.from(
      new Map(identities.map((identity) => [identity.characterId, identity])).values(),
    ),
  });
}
