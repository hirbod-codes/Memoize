import { object } from "yup";
import { calendarSchema, languageSchema, timezoneSchema } from "../../DB/models/User";

export const preferencesSchema = object().shape({
    language: languageSchema.required(),
    calendar: calendarSchema.required(),
    timezone: timezoneSchema.required(),
}).required()
