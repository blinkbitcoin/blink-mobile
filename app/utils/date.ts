/* eslint-disable no-param-reassign */
import i18n from 'i18n-js';
import moment from 'moment';

moment.locale(i18n.locale)

// refactor these utils
export const sameDay = (d1: number, d2: number | Date): boolean => {
  const parsed_d1 = new Date(1000 * d1) // XXX FIXME

  if (typeof d2 === "number") {
    d2 = new Date(d2)
  }

  return (
    parsed_d1.getFullYear() === d2.getFullYear() &&
    parsed_d1.getMonth() === d2.getMonth() &&
    parsed_d1.getDate() === d2.getDate()
  )
}

export const sameMonth = (d1: number, d2: number | Date): boolean => {
  const parsed_d1 = new Date(1000 * d1) // XXX FIXME

  if (typeof d2 === "number") {
    d2 = new Date(d2)
  }

  return (
    parsed_d1.getFullYear() === d2.getFullYear() && parsed_d1.getMonth() === d2.getMonth()
  )
}

/**
 * Parse a unix time stamp to a JavaScript date object
 * @param  {number} timeStamp The unix time stamp in seconds
 * @return {Date}             The date object
 */
export const parseDate = (timeStamp: number): Date => {
  if (!Number.isInteger(timeStamp)) {
    throw new Error("Invalid input!")
  }
  return new Date(timeStamp * 1000)
}

export const unixTime = (): number => Math.floor(Date.now() / 1000)

export const formatDate = ({ createdAt, showFullDate }: { createdAt: number, showFullDate: boolean }) => {
  if (!createdAt || isNaN(createdAt)) {
    console.error("Invalid 'createdAt' value:", createdAt);
    return '';
  }
  const locale = i18n.locale.split('-')[0] || 'en';
  return showFullDate
    ? moment.unix(createdAt).locale(locale).format('L h:mm a')
    : moment.duration(Math.min(0, moment.unix(createdAt).diff(moment()))).humanize(true);
};