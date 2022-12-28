// prettier-ignore

import { Translation } from "../i18n-types"
import en from '../en'
import rawPtBR from '../raw-i18n/translations/pt-BR.json'
import merge from "lodash.merge"

/* eslint-disable no-template-curly-in-string */
/* eslint-disable max-lines */
const ptBR: Translation = merge({}, en as Translation, rawPtBR)

export default ptBR
