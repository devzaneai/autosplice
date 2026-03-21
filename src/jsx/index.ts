// @include './lib/json2.js'

import { ns } from "../shared/shared";
import * as ppro from "./ppro/ppro";

//@ts-ignore
const host = typeof $ !== "undefined" ? $ : window;

host[ns] = ppro;

export type Scripts = typeof ppro;
