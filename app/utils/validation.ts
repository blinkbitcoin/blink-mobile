import { translate } from "@app/i18n"

export class InvalidUsernameError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
  }
}

export class UsernameValidation {
  static usernameRegex = /(?!^(1|3|bc1|lnbc1))^[0-9a-z_]{3,50}$/i

  public static Invalid3CharactersMin = translate("UsernameScreen.3CharactersMinimum")
  public static Invalid50CharactersMax = translate("UsernameScreen.50CharactersMaximum")
  public static InvalidLettersAndNumbers = translate("UsernameScreen.letterAndNumber")
  public static InvalidEmailAddress =
    translate("UsernameScreen.emailAddress") +
    ". " +
    translate("UsernameScreen.letterAndNumber")
  public static InvalidStartCharacters = translate("UsernameScreen.forbiddenStart")
  public static InvalidUnexpected = translate("errors.unexpectedError")

  public static checkedToUsername = (username: string): string | InvalidUsernameError => {
    if (!username.match(this.usernameRegex)) {
      switch (false) {
        case this.hasValidLength(username):
          return username.length > 3
            ? new InvalidUsernameError(this.Invalid50CharactersMax)
            : new InvalidUsernameError(this.Invalid3CharactersMin)
        case this.hasValidCharacters(username):
          if (this.isEmailAddress(username)) {
            return new InvalidUsernameError(this.InvalidEmailAddress)
          }
          return new InvalidUsernameError(this.InvalidLettersAndNumbers)
        case this.hasNoRestictedStartCharacters(username):
          return new InvalidUsernameError(this.InvalidStartCharacters)
        default:
          return new InvalidUsernameError(this.InvalidUnexpected)
      }
    }
    return username
  }

  public static hasValidLength = (username: string): boolean => {
    return username.length >= 3 && username.length <= 50
  }

  public static isEmailAddress = (username: string): boolean => {
    return new RegExp(
      /* eslint-disable no-useless-escape */
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    ).test(username)
  }

  public static hasValidCharacters = (username: string): boolean => {
    return new RegExp(/^[0-9a-z_]+$/i).test(username)
  }

  public static hasNoRestictedStartCharacters = (username: string): boolean => {
    return new RegExp(/^(?!bc1|1|3|lnbc1).+$/i).test(username)
  }

  public static isValid = (username: string): boolean => {
    const checkedUsername = this.checkedToUsername(username)
    return !(checkedUsername instanceof InvalidUsernameError)
  }
}
