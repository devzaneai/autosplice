// @include './lib/json2.js'

import { ns } from "../shared/shared";
import * as ppro from "./ppro/ppro";
import * as timelineOps from "./ppro/timeline-ops";

//@ts-ignore
const host = typeof $ !== "undefined" ? $ : window;

const allExports = { ...ppro, ...timelineOps };
host[ns] = allExports;

export type Scripts = typeof allExports;
