// @include './lib/json2.js'

import { ns } from "../shared/shared";
import * as ppro from "./ppro/ppro";
import * as timelineOps from "./ppro/timeline-ops";

//@ts-ignore
var host = typeof $ !== "undefined" ? $ : window;

// Manual merge — cannot use object spread in ExtendScript (ES3, no Symbol)
var allFunctions: any = {};
var k: string;
for (k in ppro) { allFunctions[k] = (ppro as any)[k]; }
for (k in timelineOps) { allFunctions[k] = (timelineOps as any)[k]; }
host[ns] = allFunctions;

export type Scripts = typeof ppro & typeof timelineOps;
