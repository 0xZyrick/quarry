// Node shape determines the room type used by the project and room surfaces.
import {MapNode} from "./map";
export type Shape="crystal"|"monolith";
export const shapeOf=(n:MapNode):Shape=>n.status==="risk"?"monolith":"crystal";
