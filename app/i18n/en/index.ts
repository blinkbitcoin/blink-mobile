// prettier-ignore

import { BaseTranslation } from "../i18n-types"

const en: BaseTranslation = {
  GaloyAddressScreen: {
    title: "Receive payment by using:",
    buttonTitle: "Set your address",
    yourLightningAddress: "Your Lightning address",
    notAbleToChange:
      "You won't be able to change your {bankName: string} address after it's set.",
    addressNotAvailable: "This {bankName: string} address is already taken.",
    somethingWentWrong: "Something went wrong. Please try again later.",
    merchantTitle: "For merchants",
    yourCashRegister: "Your Lightning Cash Register",
    yourPaycode: "Your Paycode",
    copiedLightningAddressToClipboard: "Copied Lightning address to clipboard",
    copiedPaycodeToClipboard: "Copied Paycode to clipboard",
    copiedCashRegisterLinkToClipboard: "Copied Cash Register Link to clipboard",
    howToUseIt: "How to use it?",
    howToUseYourAddress: "How to use a Lightning address",
    howToUseYourPaycode: "How to use your Paycode",
    howToUseYourCashRegister: "How to use your Cash Register",
    howToUseYourAddressExplainer:
      "Share with someone that has a compatible wallet, such as:",
    howToUseYourPaycodeExplainer:
      "You can print your Paycode (technically, this is an lnurl-pay address) and display it in your business to receive payments. Individuals can pay you by scanning it with a Lightning-enabled wallet.\n\nHowever, be aware that some wallets can’t scan a Paycode such as:",
    howToUseYourCashRegisterExplainer:
      "Allow people to collect payments via the Cash Register link, without accessing your wallet.\n\nThey can create invoices and payments will be sent directly to your {bankName: string} Wallet.",
  },
  AcceptTermsAndConditionsScreen: {
    title: "Terms and Conditions",
    accept: "Accept",
    termsAndConditions: "View Terms and Conditions",
    prohibitedCountry: "View prohibited countries",
    text: "By clicking 'Accept', you agree to our Terms And Conditions. You also agree that you are not a resident or citizen from one of the prohibited countries.",
  },
  SetAccountModal: {
    title: "Set up your receive account",
    description: "You can always change this later in the Settings",
    stablesatsTag: "Dollar account — powered by Stablesats",
    bitcoinTag: "Bitcoin account for maximalists",
  },
  NoteInput: {
    addNote: "Add note",
  },
  AuthenticationScreen: {
    authenticationDescription: "Authenticate to continue",
    setUp: "Set up Biometric Authentication",
    setUpAuthenticationDescription: "Use biometric to authenticate",
    skip: "Skip",
    unlock: "Unlock",
    usePin: "Use PIN",
    confirmLogout:
      "Are you sure you'd like to log out? This will reset your cache and all local user settings",
  },
  PeopleScreen: {
    title: "People",
    copy: "Copy",
    noContactsTitle: "No Contacts Found",
    noContactsYet:
      "Send or receive a payment using a username and contacts will automatically be added here",
    noMatchingContacts: "No contacts matching your search were found.",
    allContacts: "All Contacts",
    viewAllContacts: "View all contacts",
    frequentContacts: "Frequent Contacts",
  },
  ContactDetailsScreen: {
    title: "Transactions with {username: string}",
  },
  ConversionDetailsScreen: {
    title: "Transfer funds",
    transfer: "Transfer",
    percentageToConvert: "% to convert",
    reviewTransfer: "Review transfer",
  },
  ConversionConfirmationScreen: {
    title: "Confirm transfer",
    youreConverting: "You're converting",
    receivingAccount: "Receiving account",
    infoBitcoin: "Bitcoin amount is only approximate. It can vary by a small amount.",
    infoDollar: "Dollar amount is only approximate. It can vary by a small amount.",
    transferButtonText: "Transfer {fromWallet} to {toWallet}",
  },
  ConversionSuccessScreen: {
    message: "Transfer successful",
  },
  EarnScreen: {
    satoshi: "sat",
    satoshis: "sats",
    earnSats: "Earn {formattedNumber | sats}",
    earnSections: {
      bitcoinWhatIsIt: {
        title: "Bitcoin: What is it?",
        questions: {
          whatIsBitcoin: {
            answers: ["Digital money", "A video game", "A new cartoon character"],
            feedback: [
              "Correct. You just earned 1 “sat”!",
              "Incorrect, please try again.",
              "Nope. At least not one that we know of!",
            ],
            question: "So what exactly is Bitcoin?",
            text: "Bitcoin is digital money. \n\nIt can be transferred instantly and securely between any two people in the world — without the need for a bank or any other financial company in the middle.",
            title: "So what exactly is Bitcoin?",
          },
          sat: {
            answers: [
              "The smallest unit of Bitcoin",
              "A small satellite",
              "A space cat 🐱🚀",
            ],
            feedback: [
              "Correct. You just earned another two sats!!",
              "Maybe… but that is not the correct answer in this context 🙂",
              "Ummm.... not quite!",
            ],
            question: 'I just earned a “Sat". What is that?',
            text: "One “Sat” is the smallest unit of a bitcoin. \n\nWe all know that one US Dollar can be divided into 100 cents. Similarly, one Bitcoin can be divided into 100,000,000 sats. \n\nIn fact, you do not need to own one whole bitcoin in order to use it. You can use bitcoin whether you have 20 sats, 3000 sats — or 100,000,000 sats (which you now know is equal to one bitcoin).",
            title: 'I just earned a “Sat". What is that?',
          },
          whereBitcoinExist: {
            answers: ["On the Internet", "On the moon", "In a Federal bank account"],
            feedback: [
              "Correct. You just earned another 5 sats.",
              "Incorrect. Well… at least not yet ;)",
              "Wrong. Please try again.",
            ],
            question: "Where do the bitcoins exist?",
            text: "Bitcoin is a new form of money. It can be used by anyone, anytime -- anywhere in the world. \n\nIt is not tied to a specific government or region (like US Dollars). There are also no paper bills, metal coins or plastic cards. \n\nEverything is 100% digital. Bitcoin is a network of computers running on the internet. \n\nYour bitcoin is easily managed with software on your smartphone or computer!",
            title: "Where do the bitcoins exist?",
          },
          whoControlsBitcoin: {
            answers: [
              "A voluntary community of users around the world",
              "Mr Burns from The Simpsons",
              "The government of France",
            ],
            feedback: [
              "That is right. Bitcoin is made possible by people all around the world running bitcoin software on their computers and smartphones.",
              "An amusing thought — but not correct!",
              "Wrong. There is no company nor government that controls Bitcoin.",
            ],
            question: "Who controls Bitcoin?",
            text: "Bitcoin is not controlled by any person, company or government. \n\nIt is run by the community of users -- people and companies all around the world -- voluntarily running bitcoin software on their computers and smartphones.",
            title: "Who controls Bitcoin?",
          },
          copyBitcoin: {
            answers: [
              "No — it is impossible to copy or duplicate the value of bitcoin",
              "Yes, you can copy bitcoins just as easily as copying a digital photo",
              "Yes, but copying bitcoin requires very specialized computers",
            ],
            feedback: [
              "That is absolutely correct!",
              "You know that it is not true. Try again.",
              "Incorrect. There is no way for anyone to copy, or create a duplicate, of bitcoin.",
            ],
            question:
              "If Bitcoin is digital money, can’t someone just copy it — and create free money?",
            text: "The value of a bitcoin can never be copied. This is the very reason why Bitcoin is such a powerful new invention!!\n\nMost digital files — such as an iPhone photo, an MP3 song, or a Microsoft Word document — can easily be duplicated and shared. \n\nThe Bitcoin software uniquely prevents the duplication — or “double spending” — of digital money. We will share exactly how this works later on!",
            title:
              "If Bitcoin is digital money, can’t someone just copy it — and create free money?",
          },
        },
      },
      WhatIsMoney: {
        title: "What is Money? ",
        questions: {
          moneySocialAgreement: {
            answers: [
              "Because people trust that other people will value money similarly",
              "Because your mother told you so",
              "Because a dollar bill is worth its weight in gold",
            ],
            feedback: [
              "Correct. This is what allows money to work!",
              "She may well have. But that is not the correct answer here!",
              "Nope. In the past you could exchange US dollars for gold. But this is no longer the case.",
            ],
            question: "Why does money have value?",
            text: "Money requires people to trust. \n\nPeople trust the paper dollar bills in their pocket. They trust the digits in their online bank account. They trust the balance on a store gift card will be redeemable. \n\nHaving money allows people to easy trade it immediately for a good, or a service.",
            title: "Money is a social agreement.",
          },
          coincidenceOfWants: {
            answers: [
              "Coincidence of wants",
              "Coincidence of day and night",
              "Coincidence of the moon blocking the sun",
            ],
            feedback: [
              "That is right. Money allows you to easily purchase something, without haggling about the form of payment",
              "No silly, you know that is not the answer.",
              "Not quite. We call that a solar eclipse 🌚",
            ],
            question: "Which coincidence does money solve?",
            text: "Centuries ago, before people had money, they would barter -- or haggle over how to trade one unique item, in exchange for another item or service. \n\nLet’s say you wanted to have a meal at the local restaurant, and offered the owner a broom. The owner might say “no” -- but I will accept three hats instead, if you happen to have them. \n\nYou can imagine how difficult and inefficient a “barter economy” would be !  \n\nBy contrast, with money, you can simply present a $20 bill. And you know that the restaurant owner will readily accept it.",
            title: "Money solves the “coincidence of wants”...  What is that??",
          },
          moneyEvolution: {
            answers: [
              "Stones, seashells and gold",
              "Tiny plastic Monopoly board game houses",
              "Coins made of chocolate",
            ],
            feedback: [
              "Correct. Items that are rare and difficult to copy have often been used as money.",
              "Wrong. They may have value when playing a game -- but not in the real word!",
              "Nope. They may be tasty. But they are not useful as money.",
            ],
            question:
              "What are some items that have been historically used as a unit of money?",
            text: "Thousands of years ago, society in Micronesia used very large and scarce stones as a form of agreed currency. \n\nStarting in the 1500’s, rare Cowrie shells (found in the ocean) became commonly used in many nations as a form of money.\n\nAnd for millennia, gold has been used as a form of money for countries around the world -- including the United States (until 1971).",
            title: "Money has evolved, since almost the beginning of time.",
          },
          whyStonesShellGold: {
            answers: [
              "Because they have key characteristics -- such as being durable, uniform and divisible.",
              "Because they are pretty and shiny.",
              "Because they fit inside of your pocket",
            ],
            feedback: [
              "Correct. More key characteristics include being scarce and portable.",
              "Incorrect. That may be true, but alone are not great characteristics of money.",
              "Not quite. Although these items were surely portable, that alone was not the reason to be used as money.",
            ],
            question: "Why were stones, seashells and gold used as units of money?",
            text: "Well, these items all had some -- but not all -- of the characteristics of good money. \n\nSo what characteristics make for “good” money? \nScarce: not abundant, nor easy to reproduce or copy \nAccepted: relatively easy for people to verify its authenticity \nDurable: easy to maintain, and does not perish or fall apart\nUniform: readily interchangeable with another item of the same form\nPortable: easy to transport\nDivisible: can be split and shared in smaller pieces",
            title: "Why were stones, shells and gold commonly used as money in the past?",
          },
          moneyIsImportant: {
            answers: [
              "Money allows people to buy goods and services today -- and tomorrow.",
              "Money allows you to go to the moon.",
              "Money is the solution to all problems.",
            ],
            feedback: [
              "That is right!",
              "Incorrect. Although that may change in the future ;)",
              "Not quite. Although some people may believe such, this answer does not address the primary purpose of money.",
            ],
            question: "What is the primary reason money is important?",
            text: "Everybody knows that money matters.\n\nMost people exchange their time and energy -- in the form of work -- to obtain money. People do so, to be able to buy goods and services today -- and in the future.",
            title: "Money is important to individuals",
          },
          moneyImportantGovernement: {
            answers: [
              "The US Central Bank (The Federal Reserve)",
              "Mr Burns from The Simpsons",
              "A guy with a printing press in his basement",
            ],
            feedback: [
              "Correct. The US Government can print as much money as they want at any time.",
              "Incorrect. Although it did seem like he always had a lot of money.",
              "No. Whilst some people do create fake dollar bills, it is definitely not legal!",
            ],
            question: "Who can legally print US Dollars, anytime they wish?",
            text: "Modern-day economies are organized by nation-states: USA, Japan, Switzerland, Brazil, Norway, China, etc. \n\nAccordingly, in most every nation, the government holds the power to issue and control money. \n\nIn the United States, the Central Bank (known as the Federal Reserve, or “Fed”) can print, or create, more US Dollars at any time it wants. \n\nThe “Fed” does not need permission from the President, nor Congress, and certainly not from US citizens.  \n\nImagine if you had the ability to print US Dollars anytime you wanted to -- what would you do??",
            title: "Money is also important to governments",
          },
        },
      },
      HowDoesMoneyWork: {
        title: "How Does Money Work? ",
        questions: {
          WhatIsFiat: {
            answers: [
              "It is created by order of the National government in a given country.",
              "By the manager of the local branch bank.",
              "The Monopoly Money Man.",
            ],
            feedback: [
              "Correct. The central bank of a government creates fiat money.",
              "Incorrect. A local bank can only manage money that has been previously created by the government.",
              "Nope. Try again!",
            ],
            question: "Who creates fiat money, such as US Dollars or Swiss Francs?",
            text: "All national currencies in circulation today are called “fiat” money. This includes US Dollars, Japanese Yen, Swiss Francs, and so forth. \n\nThe word “fiat” is latin for “by decree” -- which means “by official order”. \n\nThis means that all fiat money -- including the US Dollar -- is simply created by the order of the national government.",
            title: "Fiat Currency: What is that?",
          },
          whyCareAboutFiatMoney: {
            answers: [
              "All fiat currency is eventually abused by government authorities.",
              "Local banks might not have enough vault space to hold all of the dollar bills.",
              "There might not be enough trees to make paper for all of the additional dollar bills.",
            ],
            feedback: [
              "Correct. Throughout history, governments have been unable to resist the ability to print money, as they effectively have no obligation to repay this money.",
              "Nope, that is certainly not the case.",
              "Wrong. Please try again.",
            ],
            question: "Why should I care about the government controlling fiat money?",
            text: "As shared in a prior quiz, the US Central Bank is the Federal Reserve, or the “Fed”.\n\nThe Fed can print more dollars at any time -- and does not need permission from the President, nor Congress, and certainly not from US citizens.  \n\nHaving control of money can be very tempting for authorities to abuse -- and often time leads to massive inflation, arbitrary confiscation and corruption. \n\nIn fact, Alan Greenspan, the famous former chairman of The Fed, famously said the US “can pay any debt that it has, because we can always print more to do that”.",
            title: "I trust my government. \nWhy should I care about fiat money?",
          },
          GovernementCanPrintMoney: {
            answers: [
              "The printing of additional money leads to inflation.",
              "People must exchange old dollar bills at the bank every year.",
              "The appearance of the dollar bill changes.",
            ],
            feedback: [
              "Correct. This means that goods and services will cost more in the future.",
              "Nope. Older dollar bills are just as valid as newer ones.",
              "Incorrect. Although the government may issue new looks for bills, this has nothing to do with increasing the money supply.",
            ],
            question: "What does it mean when the government prints money?",
            text: "Well, everybody should care! \n\nThe practice of government printing money -- or increasing the supply of dollars -- leads to inflation.\n\nInflation is an increase in the price of goods and services. In other words, the price for something in the future will be more expensive than today.\n\nSo what does inflation mean for citizens? \n\nIn the United Kingdom, the Pound Sterling has lost 99.5% of its value since being introduced over 300 years ago. \n\nIn the United States, the dollar has lost 97% of its value since the end of WWI, about 100 years ago. \n\nThis means a steak that cost $0.30 in 1920... was $3 in 1990… and about $15 today, in the year 2020!",
            title: "Who should care that the government can print unlimited money?",
          },
          FiatLosesValueOverTime: {
            answers: [
              "Every fiat currency that ever existed has lost a massive amount of value.",
              "The value stays the same forever.",
              "The look and design of paper bills is updated every 10 years or so.",
            ],
            feedback: [
              "Correct. This is true even for USD, which has lost 97% of its value during the last 100 years.",
              "Incorrect. Please try again.",
              "Not quite. Although the design of papers bills may change, this has nothing to do with their value.",
            ],
            question: "What happens to the value of all fiat money over time?",
            text: "That is correct. \n\nIn the history of the world, there have been 775 fiat currencies created. Most no longer exist, and the average life for any fiat money is only 27 years.\n\nThe British Pound is the oldest fiat currency. It has lost more than 99% of its value since 1694. \n\nThere is no precedent for any fiat money maintaining its value over time. This is inflation. \nIt is effectively a form of theft of your own hard earned money !",
            title: "Does this mean that all fiat money loses value over time?",
          },
          OtherIssues: {
            answers: [
              "Money is difficult to move around the world, and can also be surveilled.",
              "Money is no longer needed in the 21st Century.",
              "Money is the root of all evil.",
            ],
            feedback: [
              "Correct. We will explain more about these issues in subsequent quiz modules. Keep digging!!",
              "Wrong answer. You know that is not true.",
              "While some may believe this to be so, it is not the answer we are looking for here.",
            ],
            question: "What are some other issues that exist with fiat money?",
            text: "Yes, there are many other issues that exist with modern fiat money. \n\nFirst, it can be extremely difficult to move money around the world. Often, governments will outright restrict the movement -- and sometimes even confiscate money -- without a valid reason or explanation. And even when you can send money, high transaction fees make it very expensive.\n\nSecond, even in the US, there has been a complete loss of privacy, as the majority of commerce takes places with debit and credit cards, as well as online with other systems such as PayPal and Apple Pay.\n\nEver notice how an ad appears in your social media or Gmail just moments after searching for a certain product or service? This is known as “surveillance capitalism”, and is based on companies selling your personal financial data.",
            title: "OK, fiat money loses value over time. Are there other issues?",
          },
        },
      },
      BitcoinWhySpecial: {
        title: "Bitcoin: Why is it special? ",
        questions: {
          LimitedSupply: {
            answers: [
              "Yes. There can never be more than 21 million bitcoin created.",
              "No. The government can create more bitcoin at any time.",
              "No, the bitcoin software can be changed to allow more bitcoins to be created.",
            ],
            feedback: [
              "Correct. By limiting the amount that can be created, Bitcoin is designed to increase in value over time.",
              "Wrong answer. The government has no control over Bitcoin.",
              "Incorrect. One of the key attributes of bitcoin is that the supply is limited forever.",
            ],
            question: "Is the supply of bitcoin limited forever?",
            text: "Governments can print fiat money in unlimited quantities. \n\nBy way of contrast, the supply of Bitcoin is fixed — and can never exceed 21 million coins. \n\nA continually increasing supply of fiat money creates inflation. This means that the money you hold today is less valuable in the future. \n\nOne simple example: \nA loaf of bread that cost about 8 cents in 1920. In the year 1990 one loaf cost about $1.00, and today the price is closer to $2.50 ! \n\nThe limited supply of bitcoin has the opposite effect, one of deflation. \n\nThis means that the bitcoin you hold today is designed to be more valuable in the future — because it is scarce.",
            title: "Special Characteristic #1:\nLimited Supply",
          },
          Decentralized: {
            answers: [
              "No. Bitcoin is completely “decentralized”.",
              "Yes. It is centrally controlled by the United Nations.",
              "Yes. It is centrally controlled by the world’s largest banks.",
            ],
            feedback: [
              "That is correct. There is no company, government or institution that controls bitcoin. Anyone can use bitcoin — all need is a smartphone and an internet connection.",
              "Wrong answer. Please try again.",
              "Incorrect. You already know this is not true!",
            ],
            question: "Is bitcoin centralized?",
            text: "Fiat money is controlled by banks and governments — which is why people refer to it as a “centralized” currency.\n\nBitcoin is not controlled by any person, government or company — which makes it “decentralized” \n\nNot having banks involved means that nobody can deny you access to bitcoin — because of race, gender, income, credit history, geographical location — or any other factor. \n\nAnybody — anywhere in the world — can access and use Bitcoin anytime you want. All you need is a computer or smartphone, and an internet connection!",
            title: "Special Characteristic #2: Decentralized",
          },
          NoCounterfeitMoney: {
            answers: [
              "No. It is impossible to counterfeit Bitcoin.",
              "Yes. Although creating fake bitcoin requires very specialized computers.",
              "Yes. The government can print as much bitcoin as it likes.",
            ],
            feedback: [
              "That is the right answer. In a subsequent quiz, Honey Badger will explain details as to why this is so!",
              "Incorrect. There is no way for anyone to copy or duplicate the value of a bitcoin.",
              "Wrong. Although the government can print unlimited dollars, it can not print bitcoin.",
            ],
            question: "Can people counterfeit Bitcoin?",
            text: "Paper money, checks and credit card transactions can all be counterfeit, or faked. \n\nThe unique software that runs the Bitcoin network eliminates the possibility of duplicating money for counterfeit purposes.  \n\nNew bitcoin can only be issued if there is agreement amongst the participants in the network. People who are voluntarily running bitcoin software on their own computers and smartphones.\n\nThis ensures that it is impossible to counterfeit, or create fake bitcoins.",
            title: "Special Characteristic #3: \nNo Counterfeit Money",
          },
          HighlyDivisible: {
            answers: [
              "0.00000001 BTC",
              "One whole bitcoin. It is not possible to use anything less.",
              "0.01 BTC",
            ],
            feedback: [
              "Yes. You can divide a bitcoin into 100,000,000 pieces. As you already know, the smallest unit of bitcoin — B0.00000001 — is known as a “sat”.",
              "Wrong. Bitcoin is highly divisible. You can easily use a very small fraction of a bitcoin.",
              "Incorrect. Although the smallest unit of US currency is one penny, a bitcoin is divisible by much more than 100x.",
            ],
            question: "What is the smallest amount of Bitcoin one can own, or use?",
            text: 'Old-fashioned fiat money can only be spent in amounts as small as one penny — or two decimal places for one US Dollar ($0.01).\n\nOn the other hand, Bitcoin can be divided 100,000,000 times over. This means that you could spend as little as ₿0.00000001. You will note the "₿" symbol, which is the Bitcoin equivalent of "$". Sometimes you will also see the use of BTC, instead of ₿.\n\nBy way of contrast, Bitcoin can handle very small payments — even those less than one US penny!',
            title: "Special Characteristic #4: \nHighly Divisible",
          },
          securePartOne: {
            answers: [
              "Yes. The bitcoin network is very secure.",
              "Maybe. It depends on the day of the week.",
              "No. It is open source software, and is easily attacked.",
            ],
            feedback: [
              "Correct. In fact, the Bitcoin network has never once been hacked. Answer the next question to learn more!",
              "Nice try, but wrong. The bitcoin network is safe and secure — 24 hours a day, 365 days a year.",
              "Icorrect. Although bitcoin is indeed “open source” software — or available to the public for free — is still extremely secure.",
            ],
            question: "Is the Bitcoin network secure?",
            text: "The bitcoin network is worth well over $100 billion today. Accordingly, the network must be very secure — so that money is never stolen. \n\nBitcoin is known as the world’s first cryptocurrency. \n\nThe “crypto” part of the name comes from cryptography. Simply put, cryptography protects information through very complex math functions. \n\nMost people do not realize — but Bitcoin is actually the most secure computer network in the world ! \n\n(you may have heard about bitcoin “hacks” — which we will debunk in the next quiz)",
            title: "Special Characteristic #5: \nSecure -- Part I",
          },
          securePartTwo: {
            answers: [
              "No. Bitcoin has never been hacked.",
              "Yes. Bitcoin gets hacked frequently.",
              "Yes. Bitcoin usually gets hacked on holidays, when traditional banks are closed.",
            ],
            feedback: [
              "That is correct. The bitcoin network has never been compromised. However, it is important to use only secure digital wallets to keep your personal bitcoins safe at all times.",
              "Wrong. Please try again.",
              "No silly, you know that is not the correct answer.",
            ],
            question: "Has Bitcoin ever been hacked?",
            text: "To be direct: the bitcoin network itself has never been hacked. Never once.\n\nThen what exactly has been hacked? \n\nCertain digital wallets that did not have proper security in place. \n\nJust like a physical wallet holds fiat currency (in the form of paper bills), digital wallets hold some amount of bitcoin. \n\nIn the physical world, criminals rob banks — and walk away with US Dollars. The fact that someone robbed a bank does not have any relationship as to whether the US Dollar is stable or reliable money. \n\nSimilarly, some computer hackers have stolen bitcoin from insecure digital wallets — the online equivalent of a bank robbery. \n\nHowever, it is important to know that the bitcoin network has never been hacked or compromised !",
            title: "Special Characteristic #5: \nSecure -- Part II",
          },
        },
      },
      TheOriginsOfMoney: {
        title: "The Origins of Money",
        questions: {
          originsOfMoney: {
            answers: [
              "To store and transfer wealth",
              "To serve as a form of entertainment",
              "To act as a status symbol",
            ],
            feedback: [
              "Congratulations! You hit the nail on the head. Collectibles have long been used as a medium for storing and transferring wealth, much like how Bitcoin is used today as a decentralized digital currency",
              "Sorry, but collectibles aren't just for show - they have a deeper purpose",
              "While collectibles may serve as a status symbol for some, there's more to it than just showing off.",
            ],
            question:
              "What is the primary and ultimate evolutionary function of collectibles",
            text: 'The earliest human societies engaged in trade through barter, but this method had several limitations. One issue was the "double coincidence of wants" problem, where two people needed to desire the same item at the same time in order to complete a trade.\n\nTo overcome this issue, humans began to collect and value certain items for their rarity and symbolic significance, such as shells, animal teeth, and flint.\n\nThese collectibles served as a way for early humans to store and transfer wealth, providing an evolutionary advantage over other species such as Homo neanderthalensis.\n',
            title: "The origins of money",
          },
          primitiveMoney: {
            answers: [
              "To store value",
              "To serve as a form of entertainment",
              "To act as a medium of exchange",
            ],
            feedback: [
              "Congratulations! You're right on the money (pun intended). Collectibles served as a store of value in paleolithic societies, much like how Bitcoin and other cryptocurrencies are used today as a digital store of value",
              "Sorry, collectibles might be fun to collect, but they had a more practical purpose in ancient societies",
              "Collectibles were not used as frequently as modern currency, so they didn't quite play the same role as a medium of exchange.",
            ],
            question:
              "What was the primary role of collectibles in paleolithic societies",
            text: "Collectibles served as a precursor to money by allowing trade between different groups and facilitating the transfer of wealth between generations. Although they were not used as frequently as modern money in paleolithic societies, collectibles still served as a store of value and could sometimes even facilitate trade.\n\nPrimitive forms of money, such as collectibles, had a low velocity compared to modern currency and might only be transferred a few times during an individual's lifetime. However, durable collectibles that were passed down through generations had substantial value at each transfer and sometimes made trade possible.\n",
            title: "Primitive forms of money",
          },
          anticipatingDemand: {
            answers: [
              "The ability to buy collectibles at a lower price before they became widely sought after",
              "The ability to trade collectibles for other useful items",
              "The ability to impress others with their collection of rare and valuable items",
            ],
            feedback: [
              'Congratulations, you are correct! It seems that the concept of "buy low, sell high" is not a modern invention, as early humans also sought to acquire collectibles at a lower cost before their demand and trade value increased. Fun fact: this principle also applies to bitcoin, where early adopters were able to acquire bitcoins at a much lower price before their value skyrocketed',
              "Sorry, that is not the correct answer. While being able to trade collectibles for other useful items may have been a benefit of correctly anticipating demand, it was not the main advantage",
              "I'm afraid that is not the correct answer. While having a collection of rare and valuable items may have been a source of pride and admiration, it was not the main advantage",
            ],
            question:
              "What was the main advantage of being able to anticipate future demand for collectible items in early human societies",
            text: "The choice of which items to collect or create posed a significant problem for early humans, as they had to anticipate which objects would be desired by others. The ability to correctly predict which items would be in demand for their collectible value gave a significant advantage to the owner in terms of their ability to trade and accumulate wealth.\n\nSome Native American tribes, such as the Narragansetts, even focused on producing collectibles that had little practical use, but were valuable in trade.\n\nThe earlier a collectible is anticipated to be in future demand, the greater the advantage its possessor has, as it can be obtained at a lower cost before it becomes widely sought after and its trade value increases as the number of people demanding it grows.\n",
            title: "Anticipating Demand",
          },
          nashEquilibrium: {
            answers: [
              "A concept that helps societies decide on a single store of value",
              "A type of dance that promotes trade and the division of labor",
              "A musical instrument that makes it easier to conduct trade and specialize in different tasks",
            ],
            feedback: [
              "Congratulations, you are correct! A Nash Equilibrium is a concept in game theory that refers to a situation in which no player can gain an advantage by changing their strategy. In the context of choosing a store of value, achieving a Nash Equilibrium means that society has converged on a single store of value, which greatly facilitates trade and the division of labor. Fun fact: Bitcoin is often cited as an example of a Nash Equilibrium, as it has become the dominant cryptocurrency due to its perceived value and widespread adoption",
              "Sorry, that is not the correct answer. While a Nash Equilibrium has nothing to do with dance, it is an important concept in game theory that can benefit society",
              "I'm afraid that is not the correct answer. While music can bring people together and facilitate cooperation, a Nash Equilibrium has nothing to do with musical instruments. It is a concept in game theory that refers to a situation in which no player can gain an advantage by changing their strategy.",
            ],
            question: "What is a Nash Equilibrium and how does it benefit society",
            text: 'Acquiring an item with the expectation that it will be desired as a future store of value can accelerate its adoption for that purpose. This process can create a feedback loop that drives societies towards adopting a single store of value.\n\nIn game theory, this is known as a "Nash Equilibrium". Reaching a Nash Equilibrium for a store of value can greatly benefit a society, as it makes trade and the division of labor easier and paves the way for the development of civilization.\n',
            title: "The Key to Facilitating Trade",
          },
          singleStoreOfValue: {
            answers: [
              "To increase the purchasing power of their savings",
              "To learn about other cultures and societies",
              "To show off their wealth and status",
            ],
            feedback: [
              "Correct! Merchants and traders had an incentive to promote the adoption of a foreign store of value in their own society because it increased the purchasing power of their savings. This not only benefited the merchants, but also the society as a whole, as the adoption of a single store of value reduced the cost of completing trade with other societies and increased trade-based wealth. Fun fact: Bitcoin is an example of a store of value that has been adopted by many societies, and its widespread adoption has increased its purchasing power and facilitated trade",
              "Sorry, that is not the correct answer. While learning about other cultures and societies may have been a side benefit of promoting the adoption of a foreign store of value, it was not the main reason",
              "I'm afraid that is not the correct answer. While showing off wealth and status may have been a motivation for some individuals, it was not the main reason for why merchants and traders had an incentive to promote the adoption of a foreign store of value in their own society.",
            ],
            question:
              "Why did merchants and traders in early human societies have an incentive to promote the adoption of a foreign store of value in their own society",
            text: "As human societies and trade routes developed over time, stores of value that emerged in different societies began to compete with each other. Merchants and traders had to decide whether to save their profits in the store of value of their own society or in the store of value of the society they were trading with, or a combination of both.\n\nHolding savings in a foreign store of value gave merchants the ability to complete trade more easily in that society, and also gave them an incentive to promote the adoption of that store of value in their own society, as it would increase the purchasing power of their savings.\n\nWhen two societies adopt the same store of value, they see a significant reduction in the cost of trading with each other and an increase in trade-based wealth. In the 19th century, most of the world converged on a single store of value – gold – and this period saw the greatest increase in trade in history.\n",
            title: "The Benefits of Converging on a Single Store of Value",
          },
        },
      },
      AttributesOfAGoodStoreOfValue: {
        title: "Attributes of a good Store of Value",
        questions: {
          whatIsGoodSOV: {
            answers: [
              "Durability, portability, interchangeability, verifiability, divisibility, scarcity, long history, and resistance to censorship",
              "Tastiness, cuteness, softness, and Instagram-ability",
              "Rarity, beauty, and sentimental value",
            ],
            feedback: [
              "Yes! A good store of value should have attributes such as durability, portability, interchangeability, verifiability, divisibility, scarcity, a long history, and resistance to censorship. These characteristics make it easier to use as a medium of exchange and store of value, and increase its demand over time",
              "Sorry, that is not the correct answer. While tastiness, cuteness, softness, and Instagram-ability may be desirable qualities in other contexts, they are not typically considered important attributes for a store of value",
              "I'm afraid that is not the correct answer. While rarity, beauty, and sentimental value may make an item valuable to a particular individual, they are not typically considered important attributes for a store of value that is widely accepted and used as a medium of exchange.",
            ],
            question: "What are some attributes that make a good store of value",
            text: "When stores of value compete with each other, the attributes that make a good store of value allow it to outperform its competitors and increase demand over time.\n\nMany goods have been used as stores of value but certain attributes are particularly desirable and allow these goods to be more successful.\n\nAn ideal store of value should be durable, portable, interchangeable, verifiable, divisible, scarce, have a long history, and resistant to censorship.\n",
            title: "Some stores of value are better than others",
          },
          durability: {
            answers: [
              "The network that secures the currency",
              "The physical manifestation of the currency",
              "The institution that issues the currency",
            ],
            feedback: [
              "You got it right. The network that secures the currency is an important factor in determining its durability, especially for digital currencies like bitcoin. Did you know that bitcoin has displayed a high level of \"anti-fragility\" despite attempts to regulate it and attacks by hackers? That's quite impressive for a currency that's still in its early stages",
              "Nope, sorry! The physical manifestation of the currency is actually not as important as the institution that issues it or the network that secures it. Don't worry though, you're not alone in making this mistake. Even the Ancient Greeks used to mint their coins out of perishable materials like bronze and copper",
              "Close, but not quite! The institution that issues the currency is actually an important factor in determining its durability. But hey, at least you're not alone in this mistake. There have been many governments and currencies that have come and gone over the centuries.",
            ],
            question:
              "Which of the following is an important factor in determining the durability of a good store of value",
            text: 'The good used as money should not be perishable or easily destroyed. Gold is known for its durability and is often considered the "king" in this regard.\n\nA large portion of the gold that has ever been mined or minted, including the gold of the Pharaohs, still exists today and is likely to remain available for many more years. Gold coins that were used as money in ancient times still hold significant value today.\n\nFiat currencies and bitcoins are digital records that may take physical form, such as paper bills. However, it is not the physical manifestation of these currencies that should be considered for their durability, but rather the durability of the institution that issues them.\n\nMany governments and their currencies have come and gone over the centuries, while others, such as the US dollar and British pound, have survived for a longer period of time. Bitcoins have no issuing authority, so their durability depends on the network that secures them. While it is still early to draw strong conclusions about the durability of bitcoins, there are signs that the network has displayed a high level of "anti-fragility" despite attempts to regulate it and attacks by hackers.\n',
            title: "Durability is an important attribute for a good store of value",
          },
          portability: {
            answers: [
              "Its physical form",
              "Its ability to be easily transported and stored",
              "Its ability to facilitate long-distance trade",
            ],
            feedback: [
              "You got it right. The physical form of the good is not a factor that makes it portable. In fact, digital currencies like bitcoin are the most portable stores of value because they can be easily stored on a small device and transmitted quickly across long distances. Did you know that private keys representing hundreds of millions of dollars can be stored on a tiny USB drive and easily carried anywhere with bitcoin? That's pretty impressive",
              "Sorry, that's incorrect! The ability to be easily transported and stored is actually an important factor that makes a good store of value portable. But don't worry, it's a common mistake. After all, who wouldn't want to carry around a cow as a store of value? It would make for a pretty impressive conversation starter at least",
              "Oops, that's not the right answer! The ability to facilitate long-distance trade is actually an important factor that makes a good store of value portable. But hey, at least you're not alone in this mistake. It's easy to see how someone might think that cows are the perfect portable store of value, given their ability to produce milk and beef.",
            ],
            question:
              "Which of the following is NOT a factor that makes a good store of value portable",
            text: '\n"Portability" refers to how easy it is to move or transport a good from one place to another.\n\nBitcoins are highly portable, allowing for easy storage on a small USB drive and quick transmission across long distances. Similarly, fiat currencies are also digital and therefore portable, but government regulations and capital controls can make large transfers of value difficult or impossible.\n\nOn the other hand, gold, being physical in form and very dense, is the least portable store of value, with the majority of bullion never being transported and the transfer of physical gold being costly, risky, and time-consuming.\n',
            title: "The good must be easy to transport and store",
          },
          fungibility: {
            answers: [
              "The shape and quality of diamonds are irregular",
              "Gold is more valuable than diamonds",
              "Gold is more abundant than diamonds",
            ],
            feedback: [
              "Exactly**!** The irregular shape and quality of diamonds makes them less interchangeable than gold, which is why gold is considered more fungible. Did you also know that bitcoin is considered fungible at the network level, but its traceability on the blockchain can sometimes lead to it being treated as non-fungible by merchants or exchanges",
              "Wrong answer! Gold may be more valuable than diamonds, but that's not the main reason it's considered more fungible. Looks like you need to brush up on your fungibility knowledge",
              "Nope, sorry! While gold may be more abundant than diamonds, that's not the main reason it's considered more fungible. Better luck next time!",
            ],
            question:
              "What is the main reason that gold is considered more fungible than diamonds",
            text: '\n"Fungibility" means that one unit of a currency is interchangeable with another unit of the same currency. This is an important attribute for a good store of value.\n\nGold is a highly fungible store of value, as when melted down, an ounce of gold is essentially indistinguishable from any other. Fiat currencies, on the other hand, may not always be completely fungible, as their issuing institutions may treat different denominations differently.\n\nLike gold, units of bitcoin are fungible, but there are some nuances to it. We\'ll dive into this in a later chapter.\n',
            title:
              "One specimen should be interchangeable with another of equal quantity",
          },
          verifiability: {
            answers: [
              "By using cryptographic signatures",
              "By checking for gold-plated tungsten",
              "By checking for features on banknotes to prevent counterfeiting",
            ],
            feedback: [
              "Congratulations! You are correct. Bitcoin can be verified with mathematical certainty using cryptographic signatures",
              "Sorry, but that's not quite right. Better luck next time",
              "Wrong! Bitcoin is purely digital and doesn't utilize banknotes. Try again!",
            ],
            question: "How can bitcoin be verified",
            text: "It is important for a good store of value to be easily verifiable as authentic. This increases confidence in trade and the likelihood that a transaction will be completed.\n\nBoth fiat currencies and gold are generally easy to verify, but they are not foolproof. Counterfeit bills and gold-plated tungsten have been used to deceive people in the past.\n\nOn the other hand, the use of cryptography makes verification very easy for bitcoin and makes counterfeiting impossible.\n",
            title: "The good must be easy to quickly identify and verify as authentic",
          },
          divisibility: {
            answers: ["Gold", "Bitcoin", "Fiat currency"],
            feedback: [
              "You are correct. Gold is difficult divide into small quantities for everyday trade. Did you know that gold has been used as a store of value for thousands of years due to its rarity and durability",
              "Sorry, but that's not quite right. Bitcoin is highly divisible into its base unit 'satoshi', and it can even be divided into milli-satoshis (1/1000 of a satoshi) on the Lightning Network",
              "Nope**.** While fiat currencies are not as divisible as bitcoin, they are easily divisible into smaller denominations.",
            ],
            question:
              "Which of the following is NOT a good store of value due to its difficulty in being easily divided for day-to-day trade",
            text: "The ability to divide a good is an important attribute for it to be a good store of value.\n\nImagine you have a $100 bill and want to buy a pack of chewing gum that costs 10 cents. The success of the trade depends on the seller having $99.90 in change available in that moment.\n\nIn societies where trade is prevalent, the ability to divide a good into smaller quantities allows for more precise exchange and can make it easier to use in day-to-day transactions.\n\nBitcoin is particularly useful in this regard, as it can be divided down to a hundred millionth of a unit and transmitted in tiny and exact amounts.\n\nFiat currencies are typically divisible down to pocket change, which has little purchasing power, making fiat divisible enough in practice.\n\nGold, while physically divisible, can be difficult to use in small quantities for everyday trade.\n",
            title: "The good must be easy to subdivide",
          },
          scarce: {
            answers: ["Scarcity", "Abundance", "Ease of production"],
            feedback: [
              "Congratulations! You are correct. Did you know that there will only ever be a maximum of 21 million bitcoins in circulation, making it a scarce and valuable asset",
              "Sorry, but abundance is not the most important attribute for a store of value. Better luck next time",
              "Sorry, but ease of production is not the most important attribute for a store of value. Better luck next time!",
            ],
            question: "What is the most important attribute of a store of value",
            text: "A good store of value should have a limited supply, or be scarce.\n\nThis is because scarcity can create value, as people often desire rare or hard-to-obtain items. Bitcoin, for instance, is designed to have a maximum of 21 million units, which gives each owner a known percentage of the total possible supply.\n\nIn contrast, the supply of gold can potentially increase through new mining methods, and fiat currencies are often prone to inflation, leading to a decline in value over time.\n",
            title: "A monetary good must scarce",
          },
          establishedHistory: {
            answers: [
              "The new arrival has a significant advantage over the established good",
              "The established good has a longer history of being valued by society",
              "The new arrival is cheaper to produce",
            ],
            feedback: [
              "You are correct. A long-established store of value is less likely to be displaced by a new arrival unless the new arrival has a significant advantage over the established good",
              "Sorry, but this is actually the reason that a long-established store of value is less likely to be displaced. Better luck next time",
              "Nope, wrong. Did you not pay attention in the previous lesson on scarcity?",
            ],
            question:
              "What is the main reason that a long-established store of value could be displaced by a new arrival",
            text: "This is because a well-established store of value is less likely to be displaced by a newcomer, unless it has a significant advantage over the established good.\n\nAdditionally, people are creatures of habit and will keep using what they already know.\n\nGold, for example, has a long history of being valued and has maintained its value over time. In contrast, fiat currencies, which are a relatively recent invention, have a tendency to lose value over time due to inflation.\n\nBitcoin, although it has only been around for a short time, has shown resilience in the market and is likely to continue to be valued.\n",
            title: "An established history of being valued by society",
          },
          censorshipResistance: {
            answers: [
              "Its decentralized, peer-to-peer network",
              "Its physical nature",
              "Its regulation by states",
            ],
            feedback: [
              "You are correct. The decentralized, peer-to-peer network of Bitcoin allows for transactions to be made without permission, making it a censorship-resistant good",
              "No. In fact, physical goods often require permission to cross borders and can easily be confiscated. Better luck next time",
              "Sorry, but the opposite is actually true. The fiat banking system, which is regulated by states, requires human intervention to report and prevent certain uses of monetary goods, making it prone to censorship. Try again!",
            ],
            question:
              "Which of the following is the reason that Bitcoin is considered a censorship-resistant good",
            text: "Censorship-resistance is an attribute that has become increasingly important in the digital age, as it refers to the difficulty that external parties, such as corporations or governments, have in preventing an individual from using a particular good.\n\nThis attribute is particularly valuable for individuals living under regimes that enforce capital controls or prohibit certain forms of trade. Bitcoin is often cited as being a censorship-resistant good due to its decentralized, peer-to-peer network, which allows for transactions to be made without human intervention or permission.\n\nIn contrast, the fiat banking system is regulated by states and requires human intervention to report and prevent certain uses of monetary goods, such as capital controls.\n\nGold, although it is not issued by states, can be difficult to transmit at a distance and is therefore more subject to state regulation.\n",
            title: "No permission required",
          },
        },
      },
      TheEvolutionOfMoneyI: {
        title: "The Evolution of Money I",
        questions: {
          evolutionMoney: {
            answers: [
              "The use of money as a way to exchange goods and services",
              "The history of money's development",
              "The exclusive power of governments to create money",
            ],
            feedback: [
              "Congrats, you got it right! It's interesting to note that the use of money as a medium of exchange has become more important in modern times due to the rise of electronic payment methods",
              "Wrong! But it's good that you're interested in the history of money. Try again",
              "Sorry, that's incorrect. It's true that governments do have a lot of control over the creation and issuance of money, but that's not the main focus of modern monetary economics. Try again!",
            ],
            question: "What is the main focus of modern monetary economics",
            text: "In modern times, many people in the field of monetary economics focus on the idea that money is mainly used as a way to exchange goods and services.\n\nIn the past century, however, governments have had the exclusive power to create money and have often made it difficult for money to hold its value. This lead people to believe that the main purpose of money is to be used for exchange.\n\nSome have argued that Bitcoin is not a good form of money because its value tends to change too much to be used effectively in transactions.\n\nHowever, this way of thinking is backwards. Throughout history, the use of money has developed in stages, with its value as a store of value coming before its use as a medium of exchange.\n",
            title: "The Evolution of Money",
          },
          collectible: {
            answers: [
              "Shells, beads, and gold",
              "Coins made of copper and silver",
              "Paper bills with pictures of famous leaders",
            ],
            feedback: [
              "Congratulations, you got it right! It's interesting to note that shells, beads, and gold were all valued for their appearance or special qualities before becoming widely used as money",
              "Sorry, that's incorrect. Copper and silver coins were not used as money in the very beginning of its evolution",
              "Wrong! But at least you're thinking about the more modern forms of money. Paper bills with pictures of famous leaders were not used in the very beginning of money's evolution.",
            ],
            question:
              "What were some examples of early forms of money that were valued for their appearance or special qualities",
            text: "Throughout history, money has gone through four stages of development. In the very beginning, people only wanted money because of its special qualities, and it was mostly seen as a decorative item or a collectible.;\n\nExamples of this include shells, beads, and gold, which were all collectibles before becoming widely used as money.\n",
            title: "Four Stages of Money: Collectible",
          },
          storeOfValue: {
            answers: [
              "The number of people who want it as a store of value",
              "The weather",
              "The color of the store of value",
            ],
            feedback: [
              "Nice work! The purchasing power of a store of value is determined by the number of people who want to use it as a way to store value. As more people want to use it for this purpose, the value of the store of value increases",
              "Sorry, the weather is definitely a factor in many things, but it's not quite the right answer for this question. Maybe try looking at other factors that could affect the value of a store of value",
              "I'm sorry to say that the color of a store of value probably doesn't have much of an effect on its purchasing power. It's definitely an interesting idea though! Maybe try considering other characteristics that could affect the value of a store of value.",
            ],
            question: "What determines the purchasing power of a store of value",
            text: "The store of value is the second stage of money's evolution. When enough people want money because of its special qualities, it becomes a way to keep and save value over time, to transport hard earned wealth into the future.\n\nAs more people recognize a good as a good way to store value, the good's value increases as more people want it for this purpose.\n\nEventually, the value of a store of value will stop increasing as it becomes widely held and fewer new people want it as a store of value.\n",
            title: "Four Stages of Money: Store of Value",
          },
          mediumOfExchange: {
            answers: [
              "The first time bitcoin had market value",
              "The invention of pineapple as a pizza topping",
              "again",
            ],
            feedback: [
              "You got it right. Bitcoin Pizza Day is celebrated to mark the first time that bitcoin had market value, which was when Laszlo Hanyecz traded 10,000 bitcoins for two pizzas. It's an important event in the evolution of bitcoin",
              "While pineapple is a beautiful fruit, it has no place on a real pizza! Apart from this side note, your answer is wrong. Try again",
              "Sorry, the best pizza recipe is a matter of personal preference. While pizza is always delicious, it's not the focus of Bitcoin Pizza Day. Maybe try considering the significance of the event in the history of bitcoin.",
            ],
            question: "What is Bitcoin Pizza Day celebrated for",
            text: "When money is used to store value, its value becomes stable eventually. And when the value of money is stable, it becomes the best option to facilitate trade as it's easy to use and doesn't have the coordination burden of barter.\n\nIn the early days of Bitcoin in 2010, some people did not recognize the opportunity cost to use Bitcoin as a medium of exchange rather than a nascent store of value.\n\nThere is a famous story about Laszlo Hanyecz who traded 10,000 bitcoins (which were worth about $165 million at the time of this writing) for just two pizzas. When Laszlo acquired those pizzas, it marked the first time that bitcoin had market value.\n\nToday, Laszlo's pizza is celebrated globally on May 22 as Bitcoin Pizza Day as an important step and milestone in the evolution of bitcoin as money.\n",
            title: "Four Stages of Money: Medium of Exchange",
          },
          unitOfAccount: {
            answers: [
              "When merchants are willing to accept it as payment without considering the exchange rate with other currencies",
              "When it is used to buy ice cream",
              "When it is used to play games with friends",
            ],
            feedback: [
              "Congrats! For bitcoin to be considered a unit of account, it needs to be widely accepted as a form of payment without regard to its exchange rate with other currencies. This means that merchants would be willing to accept it as payment without considering the value of bitcoin in terms of other currencie",
              "I'm sorry, but while ice cream is delicious, it's not quite the right answer. Maybe try considering other factors that could affect the acceptance of bitcoin as a unit of account",
              "Playing games with friends is always fun, but unfortunately it's not the correct answer. Maybe try thinking about what it would take for bitcoin to be widely accepted as a form of payment.\"",
            ],
            question: "How can bitcoin be considered a unit of account",
            text: "When money is commonly used for trading, goods are priced in terms of it. This means that most goods can be exchanged for money at a certain rate.\n\nIt is not accurate to say that many goods can be bought with bitcoin today. For example, while a cup of coffee might be available for purchase using bitcoin, the price listed is not the true value of bitcoin. Instead, it is the dollar price that the merchant wants, converted into bitcoin based on the current exchange rate between dollars and bitcoin.\n\nIf the value of bitcoin goes down in terms of dollars, the merchant will ask for more bitcoin to equal the same dollar amount.\n\nBitcoin can only be considered a unit of account (a standard way to measure the value of goods) when merchants are willing to accept it for payment without considering the exchange rate with other currencies.\n",
            title: "Four Stages of Money: Unit of Account",
          },
          partlyMonetized: {
            answers: [
              "A good that is not yet widely used as a unit of account",
              "A currency that is only accepted in certain countries",
              "A good that is used as a medium of exchange but not for storing value or measuring the value of goods",
            ],
            feedback: [
              "Congratulations! You've chosen the correct answer. A partly monetized good is one that is not yet widely accepted as a unit of account, which means it is not commonly used as a standard way to measure the value of other goods. This can include goods like gold, which is often used to store value but not typically used for everyday transactions",
              "That's a creative answer, but unfortunately not quite right. Better luck next time",
              "Not quite correct, but close! Keep thinking.",
            ],
            question: 'What is the meaning of the term "partly monetized"',
            text: 'Goods that are not widely accepted as a unit of account may be considered "partly monetized" because they are used for some purposes related to money, but not all.\n\nGold is an example of a partly monetized good that is used to store value but is not widely used as a medium of exchange or unit of account. In some countries, different goods may be used for different purposes related to money, such as one good being used as a medium of exchange and another being used as a store of value or unit of account.\n\nThe dollar is an example of a good that is widely used for all three purposes of money in the United States, while the peso was an example of a good that was used as a medium of exchange in Argentina but was not a good store of value because of its volatility and regular loss of purchasing power.\n',
            title: "Partial Monetization",
          },
          monetizationStage: {
            answers: [
              "It is in the process of becoming more widely accepted as money",
              "It is currently being used as a way to trade goods and services, like other currencies.",
              "It has already completed the process of becoming more widely accepted as money and is now being used as a form of currency.",
            ],
            feedback: [
              "Bingo! You're right on the money (pun intended) with this answer. Did you know that the process of Bitcoin becoming more widely accepted as money is similar to the process gold went through to become a widely accepted form of currency",
              "Ha! You must have missed the part about it taking several years for Bitcoin to reach this stage. Keep reading",
              "Sorry to break it to you, but Bitcoin is still in the process of becoming more widely accepted as money. Better luck next time!",
            ],
            question: "What is the current stage of Bitcoin's evolution",
            text: "Bitcoin is currently changing from the first stage of being used as money to the second stage. It may take several years for Bitcoin to be used as a way to trade goods and services, like other currencies.\n\nThe process of Bitcoin becoming more widely accepted as money is uncertain, as the same process took a long time for gold and no one alive has seen a good become money in the same way that is happening with Bitcoin. There is not a lot of experience with this process, but developments around the world are very promising and happening faster in the interconnected digital age.\n",
            title: "Bitcoin is in the stage of monetization",
          },
        },
      },
      TheEvolutionOfMoneyII: {
        title: "The Evolution of Money II",
        questions: {
          notFromGovernment: {
            answers: [
              "Money is the most tradable good in any given market.",
              "Money is a government creation.",
              "Money is a magical substance created by fairies.",
            ],
            feedback: [
              "Correct. It's interesting to think about how different societies throughout history have used different items as a form of currency, from seashells to cattle to gold. But ultimately, it's the willingness of people to trade and accept an item as payment that determines its value as money",
              "Nope, sorry! Looks like the government isn't as powerful as we thought they were. Better luck next time",
              "Sorry, but it looks like the tooth fairy is the only one making magic money these days. Better luck with your next answer!",
            ],
            question: "What is money",
            text: "There is a popular misconception that money is a government creation and cannot exist without government. This is false.\n\nThe history of money goes back thousands of years to times when governments did not exist, but money did.\n\nThis proves that money is emergent and simply the most tradable good in a market. It is not a government creation and certainly does not require a government to make money work.\n",
            title: "Money is not a government creation",
          },
          primaryFunction: {
            answers: [
              "To improve the workings of small barter networks.",
              "To facilitate large scale trade networks.",
              "To reduce the need for credit.",
            ],
            feedback: [
              "Congratulations! It's interesting to think about how money has evolved over time, from its early use as a means of facilitating trade in small communities to its current role as a medium of exchange in modern economies",
              "Sorry, looks like you got it backwards! Better luck with your next guess",
              "Wrong! Credit has been around for almost as long as money, and it's likely here to stay. Better luck with your next answer.",
            ],
            question: "What was the primary function of money",
            text: "Primitive money existed long before large scale trade networks. Archeologists found that early humans used valuable tools like arrowheads, collectibles like cowry shells and commodities like barley as primitive money.\n\nThe main advantage and primary function of these primitive moneys was to improve the workings of even small barter networks. Primitive moneys achieved this by eliminating the need to match coincidences of wants, interests, supply or skill. They also greatly reduced the need for credit, which, in the absence of writing in prehistoric times, was difficult to keep track of.\n",
            title: "The primary function of money",
          },
          monetaryMetals: {
            answers: [
              "Their ability to withstand time and wear.",
              "Their rarity and difficulty to produce.",
              "Their colorful and decorative appearance.",
            ],
            feedback: [
              "Correct! It's impressive to think about how certain materials, like metal, have been able to hold value over centuries and even millennia. Good work",
              "Nice try, but not quite right. Better luck with your next answer",
              "Sorry, looks like you were a little off the mark this time. Maybe try focusing on the functional aspects of money rather than its aesthetic appeal.",
            ],
            question: "What made metals valuable as a form of money",
            text: "Metals were difficult to make, which made them rare. They also lasted longer than other materials like shells, grains, and beads. This made them valuable and easy to carry, or portable.\n\nAs technology improved, especially in the production of metal, humans were able to create more advanced, better forms of money.\n",
            title: "Monetary Metals",
          },
          stockToFlow: {
            answers: [
              "A measure of the rate at which new units of a monetary good are introduced into the existing supply.",
              "A measure of a company's financial stability.",
              "A ratio used to compare the value of different currencies.",
            ],
            feedback: [
              "That's right! The Stock to Flow ratio can be a useful tool for understanding the stability and scarcity of a particular currency or commodity. Good job",
              "Sorry, looks like you're mixing up your business jargon. Better luck with your next answer",
              "Wrong! But hey, at least you're thinking about the global economy. Better luck with your next guess.",
            ],
            question: "What is the Stock to Flow ratio",
            text: "The Stock to Flow ratio is a measure of the rate at which new units of money are added to the existing supply.\n\nTo calculate it, you divide the existing amount of money by the amount produced each year.\n\nFor something to be a good way to save value, it should become more valuable when people want to use it to save, but the people who make it should not be able to add too much of it, which would make it less valuable.\n",
            title: "Understanding the Stock to Flow Ratio",
          },
          hardMoney: {
            answers: [
              "The difficulty of producing new units of a monetary good.",
              "The value of money compared to other currencies.",
              "The amount of money in circulation.",
            ],
            feedback: [
              "That's it! **** It's interesting to think about how the hardness of money can change over time as technology advances and what was once difficult to produce becomes easier. Good job",
              "Sorry, looks like you got it backwards! Better luck with your next guess",
              "Wrong! The hardness of money has more to do with its production than its quantity. Better luck with your next answer.",
            ],
            question: "What is the hardness of money",
            text: "The difficulty of producing new units of money compared to other forms of money is called its hardness. This can change over time as technology improves and what was once difficult to produce could become easier.\n\nIn precolonial Ghana (Africa), aggry beads (made of glass) were used as money. Glassmaking was an expensive craft in that region, which gave the aggry beads a high stock-to-flow ratio and made them rather scarce.\n\nIn the 16th century, European explorers discovered the high value ascribed to these beads by the west Africans and began importing them in mass quantities; as European glassmaking technology made them extremely cheap to produce.\n\nSlowly but surely, the Europeans used these cheaply produced beads to acquire most of the precious resources of Africa. The net effect of this incursion into Africa was the transference its vast natural resource wealth to Europeans and the conversion of aggry beads from hard money to soft money.\n\nAs societies continued to evolve, they began to move away from artifact money like stones and glass beads and towards monetary metals.\n",
            title: "Hard Money and Easy Money",
          },
        },
      },
      TheEvolutionOfMoneyIII: {
        title: "The Evolution of Money III",
        questions: {
          convergingOnGold: {
            answers: [
              "Because it cannot be destroyed or synthesized from other materials.",
              "Because it is abundant and easy to find.",
              "Because it is the most attractive and visually appealing metal.",
            ],
            feedback: [
              "Exactly**.** It's interesting to think about how the qualities of different materials, such as gold's durability and rarity, can make them more valuable and desirable as a form of money. Good job",
              "Sorry, looks like you got it backwards! Better luck with your next guess",
              "Wrong! While gold may have a certain aesthetic appeal, it's ultimately its functional qualities that make it a valuable form of money. Better luck with your next answer.",
            ],
            question: "Why did the free market choose gold as a form of money",
            text: "From all monetary metals, the free market ultimately chose gold as a form of money because it has two important qualities that keep its value stable over long periods of time and across many regions of the world:\n\n1\\) Gold cannot be destroyed, and\n\n2\\) Gold cannot be made from other materials.\n",
            title: "Convergence on Gold",
          },
          originsOfPaperMoney: {
            answers: [
              "To allow for the convenient exchange of gold in place of physically transporting it",
              "To represent a promise to pay a debt",
              "To transport large amounts of gold",
            ],
            feedback: [
              'Congratulations! You\'re a gold exchange genius! Did you know that these paper notes were also known as "bearer instruments," which means that they could be traded and redeemed by anyone in possession of them',
              "Oh no, it looks like you've got a case of promissory confusion! Better luck next time",
              "Transporting gold in paper form? That's a bold move.",
            ],
            question:
              "What were paper notes used for during the expansion of trade routes",
            text: "Gold can be made into coins or bars of a specific weight and purity. When trade routes expanded, it became riskier to transport large amounts of gold.\n\nAs a solution, paper notes from trusted banks that could be exchanged for gold were used. In 900 CE, Chinese merchants initiated the use of paper currency to avoid having to carry thousands of coins over long distances. They started trading paper receipts from custodians where they had deposited money or goods.\n\nIn the beginning these paper notes were personally registered, but they soon became a written order to pay the amount to whomever had it in their possession (bearer instrument). These notes can be seen as a predecessor to today's banknotes.\n",
            title: "The Origins of Paper Money Backed by Gold",
          },
          fractionalReserve: {
            answers: [
              "To allow people to earn money from their gold",
              "To make it easier for banks to hold large amounts of gold",
              "To make it easier for banks to make loans",
            ],
            feedback: [
              "Congratulations! You're a banking history expert! Did you know that Fractional Reserve Banking is a system in which banks are allowed to hold only a fraction of the deposits they receive as reserves, while using the rest to make loans",
              "Hmm, it looks like you're a little off the mark. Better luck next time",
              "Sorry, but it looks like you're mixing up your banking systems. Better luck next time!",
            ],
            question: "Why did Fractional Reserve Banking develop",
            text: "Fractional Reserve Banking is a system in which banks are allowed to hold only a fraction of the deposits they receive as reserves, while using the rest to make loans.\n\nOne reason this system developed is because people wanted to earn money from their gold, rather than paying to store it.\n\nThey could do this by allowing a bank or vault to lend out their gold and receiving interest payment in return.\n\nIf more people deposited their gold than wanted to take it back, the bank could make more profit by using the same gold as collateral for multiple loans, hence keeping only a fraction of loans in reserve.\n",
            title: "The Invention of Fractional Reserve Banking",
          },
          bankRun: {
            answers: [
              "A sudden drain of deposits en masse, leading to systemic fears and drying up of liquidity",
              "A nice vacation for everyone",
              "A sudden increase in the price of gasoline",
            ],
            feedback: [
              "masse, leading to systemic fears and drying up of liquidity",
              "Sorry, taking a vacation isn't quite the outcome we're looking for here. Better luck next time",
              "Gas prices might fluctuate for a variety of reasons, but this particular scenario doesn't have much to do with it. Try again!",
            ],
            question:
              "What is a potential outcome of banks issuing more paper notes than they held deposits",
            text: "Banks sometimes issued more paper notes than they had deposits, which could cause problems in the economy. If people started to doubt the solvency of a bank, they might rush to withdraw their money all at once before others do. This is called a bank run.\n\nThe sudden loss of deposits from the bank run could reveal that the bank was using too much leverage through Fractional Reserve Banking. This could cause a lack of liquidity and bring the whole financial system to a stop.\n",
            title: "Problems of Fractional Reserve Banking",
          },
          modernCentralBanking: {
            answers: [
              "To create a unified national currency and provide a backup plan for other banks",
              "To sell ice cream and provide a place for people to play games",
              "To act as a personal stylist and wardrobe consultant for the royal family",
            ],
            feedback: [
              'Congratulations, you got it right! Did you know that central banks also act as the "lender of last resort," meaning they can give out money when needed to make sure people\'s deposits are secure',
              "I'm sorry, but central banks do not sell ice cream or provide a place for people to play games. They have much more important responsibilities",
              "I'm afraid you are mistaken. Central banks do not act as personal stylists or wardrobe consultants for the royal family. Try again!",
            ],
            question: "What is the purpose of a central bank",
            text: 'To counter the problem of bank runs, governments created their own banks called "central banks."\n\nThese central banks have the special power to create money. They act as a backup plan for when commercial banks run out of reserves and need extra money to stay open.\n\nBecause of this function, central banks are also called the "lenders of last resort," meaning they can create and give out money when commercial banks need liquidity to service withdrawals.\n',
            title: "Modern Central Banking",
          },
          goldBacked: {
            answers: [
              "It made it difficult for governments to borrow money",
              "It made it hard for people to save money in the bank",
              "It required governments to hold a petting zoo in their treasury",
            ],
            feedback: [
              "Yep! The gold standard made it difficult for governments to borrow money because they had to hold a certain amount of gold in reserve in order to issue a certain amount of currency",
              "I'm sorry, but the gold standard did not make it hard for people to save money in the bank. It was actually a problem for citizens because it did not provide any guarantee that their deposits in the bank would be safe, as the value of their money was dependent on the government's ability to maintain its gold reserves",
              "An amusing idea, but nonsense nevertheless! Try again.",
            ],
            question:
              "What was the main problem with the gold standard system for governments and citizens",
            text: "In the past, some governments linked the value of their currency to a specific amount of gold, a system known as a \"gold standard.\" This meant that the government had to hold a certain amount of gold in reserve in order to issue a certain amount of currency.\n\nThis system limited the government's ability to borrow money because they could not simply print more currency to cover the cost of borrowing. Governments often borrowed money to finance wars or other expensive projects, but the gold standard made it difficult for them to do so without first accumulating enough gold to back the new currency they wanted to issue.\n\nThe gold standard was also problematic for citizens because it did not provide any guarantee that their deposits in the bank would be safe, as the value of their money was dependent on the government's ability to maintain its gold reserves.\n",
            title: "From Gold to Gold-Backed",
          },
          brettonWoods: {
            answers: [
              "To link the value of other countries' currencies to the value of gold through the US dollar",
              "To create a new global currency made out of chocolate coins",
              "To establish a network of trampoline parks in every major city",
            ],
            feedback: [
              "That's right. The Bretton Woods system was established after World War II in order to address global economic instability and high levels of debt. It linked the value of other countries' currencies to the value of the US dollar, which was itself pegged to the value of gold at a fixed exchange rate",
              "Sweet idea, but not very practical. Or would you prefer your money to melt away even faster? Try again",
              "Trampoline parks would have surely made for a great distraction of the public from the strange machinations of the Bretton Woods system. Have you considered applying as an advisor at the IMF or World Bank? Try again!",
            ],
            question: "What was the main purpose of the Bretton Woods system",
            text: "After World War I and II, many countries were financially exhausted and did not have a lot of money. The United States had a lot of gold because they sold a lot of weapons and other military equipment to other countries during the wars. As a result, the United States controlled about two-thirds of the world's gold.\n\nIn order to fix the global economy, a new system was created where countries would link their own currencies to the value of the US dollar.\n\nThe US dollar, in turn, would be linked to the value of gold. This meant that the value of other countries' currencies would be based on the value of the US dollar, which was based on the amount of gold the United States had.\n",
            title: "The Bretton Woods System",
          },
          globalReserve: {
            answers: [
              "A type of money that is widely used in international trade and financial transactions",
              "A currency made out of rainbow-colored paper and glitter",
              "The currency of the nation that pays the biggest share of the World Trade Organization's budget",
            ],
            feedback: [
              "Correct! A global reserve currency is a type of money that is widely used in international trade and financial transactions. It is the preferred or most in-demand currency for settling transactions, as it is generally stable and widely accepted",
              "While most banknotes are made of colorful pieces of paper with strings of glitter as security features in them, this is not what defines a global reserve currency. Try again",
              "Surely this would benefit the WTO's funding immensely, but this is not how the global reserve currency is defined or chosen. Try again!",
            ],
            question: "What is a global reserve currency",
            text: "A global reserve currency is a type of money that is widely used in international trade and financial transactions. It is the preferred or most in-demand currency for settling transactions, as it is generally stable and widely accepted.\n\nChanges to the global reserve currency can have significant geopolitical implications, as it can affect the balance of power between countries.\n\nThe dominant global reserve currency has typically had a lifespan of several decades, with the US dollar serving as the dominant global reserve currency for much of the 20th century.\n",
            title: "The Global Reserve Currency",
          },
        },
      },
      TheEvolutionOfMoneyIV: {
        title: "The Evolution of Money IV",
        questions: {
          nixonShock: {
            answers: [
              "It ended and was replaced by a new monetary system based on floating exchange rates",
              "It became a popular TV game show",
              "It was turned into a giant roller coaster ride",
            ],
            feedback: [
              "Correct! In 1971, President Nixon directed the US Treasury Secretary to stop allowing foreign governments to exchange their dollars for gold",
              "Not quite, but a game show version of the Bretton Woods system sounds like it could be entertaining",
              "I see what you did there, but this isn't the correct answer here. Try again!",
            ],
            question: "What happened to the Bretton Woods system in 1971",
            text: 'The Bretton Woods system was a monetary system established after World War II in order to address global economic instability and high levels of debt.\n\nUnder this system, many countries pegged their own currencies to the value of the US dollar, which was itself pegged to the value of gold at a fixed exchange rate. This meant that the value of other countries\' currencies was indirectly tied to the value of gold through the US dollar.\n\nIn 1971, United States President Richard Nixon directed the US Treasury to stop allowing foreign governments to exchange their dollars for gold, a process known as "convertibility."\n\nThe sudden end of convertibility of dollars for gold shocked the world and became known as the Nixon Shock, effectively ending the Bretton Woods system fixed exchange rates. It marked the beginning of a new monetary system based on floating exchange rates.\n',
            title: "The Nixon Shock",
          },
          fiatEra: {
            answers: [
              "A currency issued by a government decree",
              "A type of currency that is only accepted by merchants who love pizza",
              "A currency made out of precious gems and metals",
            ],
            feedback: [
              "Good job. Fiat money, such as Federal Reserve notes, is a type of currency issued by a government that is not directly exchangeable for a fixed amount of something else, like gold or silver. Its value comes from the fact that the government says it is valuable and people trust that they will be able to use it to buy things",
              "Not quite, but a currency that is only accepted by pizza-loving merchants sounds like it could be a delicious way to pay for things",
              "Nope, but a currency made out of precious gems and metals would definitely be shiny and eye-catching.",
            ],
            question:
              'What does the word "fiat" mean when it is used to talk about money',
            text: '"Fiat" is a word that comes from Latin and means "let it be done." When it is used to talk about money, it means that a government is creating a currency by decree alone.\n\nSince the Nixon Shock, fiat money is not backed by gold or silver and neither can it be directly converted for a fixed amount of gold, as it used to be before.\n\nThis means that their value comes from the fact that the government says they are valuable and that people trust that they will be able to use them to buy things.\n\nIn addition, governments often make it a law (legal tender) that merchants have to accept this type of fiat currency and that it is the only type of currency that can be used to pay taxes.\n',
            title: "The Fiat Era",
          },
          digitalFiat: {
            answers: [
              "A government issued money that exists only in digital form, like on a computer or phone",
              "A type of currency that can only be used to buy things in the internet",
              "A currency that can only be sent by email",
            ],
            feedback: [
              "Good job. Digital fiat is a type of money that exists only in digital form, like on a computer or phone. It is a digital representation of physical cash, such as paper money or coins, and is becoming increasingly popular due to its lower costs, faster speeds, and increased capabilities for surveillance",
              "Not quite. While digital fiat is digital like the internet, it is also widely accepted at brick and mortar merchants. Try again",
              "Nope, you guessed wrong. The use of such a currency would be extremely limited and doesn't exist to our knowledge. Try again!",
            ],
            question: "What is digital fiat",
            text: "Digital fiat is a type of money that exists only in digital form, like on a computer or phone. It is a digital representation of physical cash, such as paper money or coins.\n\nDigital fiat became possible with the proliferation of digital communication networks, like the internet, and the growth of consumer devices like computers and phones that can connect to these networks. Standardized payment protocols, which are established ways of making payments online, also played a role in the emergence of digital fiat.\n\nDigital fiat is increasingly replacing physical fiat due to its lower costs, faster speeds, and increased capabilities for surveillance. In other words, it is cheaper and faster to use digital fiat and it is easier to track transactions made with digital fiat.\n",
            title: "Digital Fiat",
          },
          plasticCredit: {
            answers: [
              "A type of payment card that allows people to borrow money to pay for things",
              "A card that grants the holder special powers, like the ability to fly",
              "A card that allows people to pay for things by waving their hand over a sensor",
            ],
            feedback: [
              "Correct. A credit card is a type of payment card that allows people to borrow money from the credit card company to pay for things now, rather than saving up money to pay for things later. There are about three billion credit cards in use around the world today",
              "Not quite, but a credit card that grants special powers like the ability to fly sounds like it could be a lot of fun",
              "Nope, but a credit card that allows people to pay for things by waving their hand over a sensor sounds like something out of a science fiction movie, not real life.",
            ],
            question: "What is a credit card",
            text: "The credit card is a type of payment card that allows people to borrow money to pay for things. When people use credit cards, they are borrowing money from the credit card company to pay for things now, rather than saving up money to pay for things later.\n\nThis has gradually normalized the act of borrowing for consumption, something that impacts the time preference of users. Instead of waiting to save up the money, the invention of credit cards has made it more common for people to borrow money to buy things they want right away\n\nToday, there are about three billion credit cards in use around the world.\n",
            title: "Plastic Credit",
          },
          doubleSpendProblem: {
            answers: [
              "The ability to ensure that the same digital unit of money cannot be spent more than once by its owner",
              "The desire to create a digital currency that could only be spent on Mars",
              "The idea of rewarding honesty and making dishonesty very costly",
            ],
            feedback: [
              "Good job. In the digital world, where it is easy to copy things, it is important to make sure that the same digital unit of money (like a digital coin) cannot be spent more than once by its owner. This was a key factor in the creation of Bitcoin, as it is important for a monetary system that works without a central authority (like a government)",
              "Not quite, but a digital currency that could only be spent on Mars sounds like it could be a fun way to support the colonization of the red planet",
              "Nope, but the idea of rewarding honesty and making dishonesty very costly is a key factor in the creation of any monetary system, as it helps to ensure trust and cooperation among participants.",
            ],
            question: "What was a key factor in the creation of Bitcoin",
            text: "In the digital world, it is easy to copy things, so it is important to make sure that the same digital unit of money cannot be spent more than once by its owner.\n\nIn a monetary system with a central authority (like a government), this problem is trivially solved by keeping a ledger of transactions managed by the central authority. However, this normally represents a single point of failure from both availability and trust viewpoints.\n\nIn a decentralized system, the double-spending problem is significantly harder to solve. Many people have tried to create digital money that is not controlled by a government, but they have all had their own unique challenges.\n\nSatoshi Nakamoto took all of these lessons into account and was the first to solve the double spending problem with the implementation of Bitcoin by creating a decentralized system that rewards honesty and makes it very costly to be dishonest.\n",
            title: "The Double Spending Problem",
          },
          satoshisBreakthrough: {
            answers: [
              "The double spending problem",
              "The problem of double coincidence of wants",
              "The halving problem",
            ],
            feedback: [
              "Good job. Bitcoin uses a proof-of-work consensus mechanism where transactions are batched into blocks and chained together to a blockchain. This way, every user knows that every coin is only spent once",
              "Not quite. The double coincidence of wants is a problem of barter that can be solved with money. Try again",
              "Hah no. The halving in bitcoin is not a problem, but part of the solution that Satoshi designed! More on that in Chapter 302. Try again!",
            ],
            question: "Which problem did Satoshi have to solve to create Bitcoin",
            text: "Satoshi's solution to the double spending problem was a breakthrough in computer science and distributed systems. Until Bitcoin, many believed that it would be unsolvable.\n\nHis solution allowed Satoshi to develop a new electronic cash system that for the first time made it possible for people to send digital money directly to each other, without needing a bank or other organization to help.\n",
            title: "Satoshi's Breakthrough",
          },
          nativelyDigital: {
            answers: [
              "Digital fiat money is based on a product from the industrial age, while Bitcoin is a purpose-built money for the digital age",
              "Digital fiat money is open-source, while Bitcoin is a closed system",
              "Digital fiat money is designed to increase in value over time, while Bitcoin is designed to lose value",
            ],
            feedback: [
              "for the digital age",
              "It seems you got things mixed up. It's actually the other way around. Try again",
              "Sorry, that's not quite right. Bitcoin is likely to increase in value over time due to its strictly fixed supply and growing deman, while inflation decreases the value of fiat currencies quite reliably.",
            ],
            question:
              "What is the main difference between digital fiat money and Bitcoin",
            text: "Digital fiat money is a digital version of a product that was designed for the industrial age. It has all of the same problems and limitations as the original product. It is a closed system that is heavily controlled and designed to lose value over time.\n\nBitcoin is a type of digital money that was specifically designed for the digital age. It can be improved and updated, and anyone can see and change the code that it is based on. It benefits from the ideas and creativity of anyone who works on it.\n",
            title: "Purpose-built for the Digital Age",
          },
          CBDCs: {
            answers: [
              "To provide surveillance and censorship capabilities to the issuer",
              "To compete with Bitcoin as a store of value",
              "To create a decentralized and permissionless digital currency",
            ],
            feedback: [
              "That's correct! CBDCs are like the Big Brother of digital currencies, designed to provide surveillance and censorship capabilities to the issuer. Creepy, but correct",
              "Haha, sorry but no. While Bitcoin and CBDCs are both digital currencies, they have very different purposes and characteristics. CBDCs are issued and backed by central banks, while Bitcoin is decentralized and not controlled by any government or financial institution",
              "Oh boy, that's a creative answer but unfortunately not quite right. CBDCs are not designed to be decentralized or permissionless like Bitcoin. In fact, they are issued and backed by central banks, and their main purpose is to be the ultimate tool for control in the digital age. Better luck next time!",
            ],
            question:
              "What is the main purpose of central bank digital currencies (CBDCs)",
            text: "Central bank digital currencies (CBDCs) are digital versions of traditional currency that are issued and backed by a central bank.\n\nCBDCs are not decentralized or permissionless like Bitcoin, and are instead intended to compete with other forms of digital payment methods for market dominance.\n\nOne of the main reasons for the development of CBDCs is the surveillance and censorship capabilities they provide the issuer.\n\nAdditionally, in an age of negative real interest rates (when the inflation rate is higher than the interest rate), the widespread adoption of CBDCs often goes hand in hand with the phasing out of physical cash, which can lead to the devaluation of the currency in real terms.\n",
            title: "Central Bank Digital Currencies",
          },
        },
      },
      BitcoinWhyWasItCreated: {
        title: "Bitcoin: Why was it created?",
        questions: {
          rootProblem: {
            answers: [
              "The trust that is required to make it work",
              "The color of the physical bills",
              "The fact that it requires physical storage",
            ],
            feedback: [
              "You got it right! The root problem with conventional currency is the trust that is required to make it work. It's an interesting point, as trust is a fundamental aspect of any currency system",
              "Interesting take, but unfortunately not the correct answer. Conventional currency isn't just about the aesthetics of its physical form, although I'm sure some people might argue otherwise",
              "Haha, while it might be inconvenient to lug around a wallet full of cash, that's not the root problem with conventional currency. But don't worry, you can try again!",
            ],
            question:
              "What is the root problem with conventional currency according to Satoshi Nakamoto",
            text: 'So what was the motivation to create Bitcoin? In his announcement of the project, Satoshi Nakamoto gave the following explanation:\n\n"The root problem with conventional currency is all the trust that’s required to make it work. The central bank must be trusted not to debase the currency, but the history of fiat currencies is full of breaches of that trust. Banks must be trusted to hold our money and transfer it electronically, but they lend it out in waves of credit bubbles with barely a fraction in reserve."\n',
            title: "The Root Problem",
          },
          bitcoinCreator: {
            answers: [
              'An unknown programmer who used the pseudonym "Satoshi Nakamoto"',
              "Craig Wright",
              "Elon Musk",
            ],
            feedback: [
              "Correct! It's an interesting mystery, but it's worth noting that the bitcoin protocol is based on open source code, meaning that anyone can review it. This transparency makes it the most reviewed code in existence. Despite the mystery of its creator, bitcoin itself is an open and transparent monetary network that can be examined and used by anyone",
              "I'm sorry, but it looks like Craig Wright's claim to being the creator of bitcoin has been thoroughly debunked. Better luck with the next answer",
              "Nope! Elon Musk's talents might be better suited to launching rockets and building electric cars rather than creating revolutionary digital currencies. Try again!",
            ],
            question: "Who is the creator of bitcoin",
            text: 'The creator of bitcoin, who used the pseudonym "Satoshi Nakamoto," is unknown and no claims of being the creator have been verified. Satoshi was only involved in the project for a short time before disappearing.\n\nThe bitcoin protocol is based on open source code, meaning that anyone can review it. This transparency makes it the most reviewed code in existence. Despite the mystery of its creator, bitcoin itself is an open and transparent monetary network that can be examined and used by anyone.\n',
            title: "Bitcoin's Creator Satoshi Nakamoto",
          },
          fiatRequiresTrust: {
            answers: [
              "The need for trusted third parties to make a currency work",
              "Lack of a physical form for currency",
              "Inflation caused by central authorities issuing more units",
            ],
            feedback: [
              "Exactly. Bitcoin requires no trusted third party and allows for transactions to be made directly between individuals, called peer-to-peer, rather than through a central authority or intermediaries",
              "Nope. That's not it. Try again",
              "Arbitrary inflation of the money supply by centralized issuers is indeed a problem that bitcoin solves elegantly, but there's a more foundational problem that Satoshi addressed. Try again!",
            ],
            question:
              "What was the main issue that Satoshi Nakamoto aimed to address with the creation of bitcoin",
            text: "The post-1971 fiat currency system requires trust at all levels because it is debt-based and lacks a scarce anchor. This includes trust in the ability to pay off debts in the future, trust in commercial and central banks not to debase the currency, and trust in their ability to allow access to and freedom to use funds for transactions.\n\nThis trust has been violated numerous times, including during the 2008/09 Global Financial Crisis. In order to address this issue, Satoshi Nakamoto aimed to create a digital form of money that did not require trusting third parties for transactions and could not be debased by a central authority issuing more units.\n",
            title: "Fiat Currencies Require Trust",
          },
          moneyPrinting: {
            answers: [
              "Asset bubbles in stock and real estate markets that experience corrections roughly every decade",
              "A sudden increase in the popularity of polka music",
              "A decrease in the number of people who believe in extraterrestrial life forms",
            ],
            feedback: [
              "Bullseye! Asset bubbles in stock and real estate markets are indeed one of the main consequences of excessive money printing and credit expansion. It's worth noting that these bubbles often disproportionately benefit those closest to the source of new money, while lower income individuals are often the most affected by the inflation and economic booms and busts that result",
              "That's not the right wavelength here! While some believe easy money has a negative impact on music, this is not the right answer",
              "Your guess is out of this world. While it's certainly interesting to speculate about the existence of aliens, it has nothing to do with the consequences of excessive money printing and credit expansion.",
            ],
            question:
              "What is one of the main consequences of excessive money printing and credit expansion",
            text: "Excessive money printing and credit expansion can cause numerous social and economic issues, including asset bubbles in stocks and real estate markets which tend to experience corrections roughly every decade.\n\nWhile those closest to the source of new money often benefit greatly from these cycles, lower income individuals who don't own valuable assets and rely on regular paychecks are often the most affected by inflation and economic booms and busts created by the fiat currency system.\n\nA well-known example of this is the Global Financial Crisis that began in 2008, which was preceded by a significant accumulation of debt and risk in the commercial banking sector.\n",
            title: "Money Printing and Credit Expansion",
          },
          genesisBlock: {
            answers: [
              "To take financial control back from financial elites, giving ordinary people a chance to take part in a decentralized financial system",
              "To create a digital form of money that could be easily debased by a central authority",
              "To make it easier for third parties to facilitate transactions",
            ],
            feedback: [
              "That's exactly right. Take a wild guess what those financial elites think about bitcoin",
              "No, silly. We already have that with fiat. Try again and think about Satoshi's message in the Genesis Block before you answer",
              "Sorry, that's not quite right. While third parties can be useful for facilitating transactions, trust in these intermediaries was one of the issues that Satoshi Nakamoto aimed to address with the creation of Bitcoin. Maybe try again with a different answer.",
            ],
            question: "Why did Satoshi Nakamoto create Bitcoin",
            text: 'It is clear why Satoshi Nakamoto created Bitcoin when we examine the first block of the Bitcoin blockchain, called the Genesis block.\n\nThis block was created by Satoshi when he launched Bitcoin in 2009 and includes a reference to banks receiving bailouts following the 2008/09 Global Financial Crisis.\n\n"The Times 03/Jan/2009 Chancellor on the brink of second bailout for banks"\n\nThis crisis, in which trust in traditional financial systems was severely damaged, inspired Satoshi to create a digital form of money that does not require trusting third parties for transactions and cannot be debased by a central authority issuing more units.\n',
            title: "The Genesis Block",
          },
          cypherpunks: {
            answers: [
              "The Cypherpunks are a group of individuals who seek to use cryptography to promote privacy and security in the digital age",
              "The Cypherpunks are a group of hackers who aim to steal personal data and sensitive information through the use of cryptography",
              "The Cypherpunks are a group of cryptographers who seek to create complex mathematical equations that are difficult to solve",
            ],
            feedback: [
              "Well done! It's interesting to note that the Cypherpunks' goal of using cryptography to promote privacy and security is particularly relevant in today's digital age, where increasing surveillance can lead to the erosion of freedoms",
              "Sorry, that's not quite right. While the use of cryptography can certainly be beneficial for hackers, the Cypherpunks seek to use cryptography for the opposite purpose. Maybe try again with a different answer",
              "Nope. While cryptography does involve the use of complex mathematical equations, the Cypherpunks are not primarily interested in creating these equations for their own sake. Try again!",
            ],
            question: "Who are the Cypherpunks and what is their goal",
            text: 'Bitcoin is the result of decades of research work by a group of individuals who call themselves Cypherpunks. They are interested in using cryptography to promote privacy and security in a world where increasing surveillance in the digital age can lead to erosion of freedoms.\n\nEarlier digital cash systems that relied on peer-to-peer (P2P) networks had one or both of the following problems:\n\n  * They required a central authority to manage the ledger of ownership.\n  * The currency units could be copied, resulting in the "double-spending problem" where a single unit could be spent multiple times.\n\n  Satoshi addressed both of these issues by combining existing technologies in the creation of Bitcoin. The first issue is resolved because the decentralized nature of the Bitcoin network means that there is no central authority that users need to trust. The second issue is addressed because the unique cryptographic techniques used in Bitcoin make it impossible to copy the currency units.\n',
            title: "Bitcoin is the Result of Decades of Research",
          },
        },
      },
      BitcoinHowDoesItWork: {
        title: "Bitcoin: How does it work?",
        questions: {
          peer2Peer: {
            answers: [
              "The blockchain",
              "The internet",
              "A decentralized network of nodes",
            ],
            feedback: [
              "Correct! Satoshi was the first to successfully implement the blockchain - a concept first described in 1991 by Stuart Haber and W. Scott Stornetta. It's a decentralized form of bookkeeping that is resistant to tampering and allows users to make and verify transactions without the need for a central authority",
              "No. The internet is a global network of interconnected computers, but it was not invented by Satoshi and does not solve issues of centralization and double spends. Try again",
              "A decentralized network of nodes is an important part of Bitcoin, but it does not solve issues of centralization and double spends by itself. Try again!",
            ],
            question:
              "Which technology did Satoshi implement to solve issues of centralization and double spends",
            text: "To solve the earlier mentioned issues of centralization and possible double spends, Satoshi invented a solution based on a decentralized network of nodes.\n\nNodes are computers that are in constant contact with each other. This by itself is nothing new. The internet itself has a similar infrastructure of interconnected nodes.\n\nAll bitcoin nodes, however, store a copy of the ledger of all transactions in the history of the Bitcoin network.\n\nThis new, decentralized form of bookkeeping, called blockchain, was first successfully implemented in Bitcoin and is extremely resistant to tampering.\n",
            title: "Peer-to-Peer Network",
          },
          blockchain: {
            answers: [
              "To create a tamper-evident record of all transactions on the blockchain",
              "To ensure that blocks can be altered or replaced easily",
              "To make sure that the Artificial Intelligence that created Bitcoin has enough computation power to take over the world",
            ],
            feedback: [
              "Correct! The cryptographic hash function helps to create a tamper-evident record of all transactions on the blockchain, which can be used to verify the integrity of the data stored on the chain. Did you know that the cryptographic hash function is also an essential part of the proof-of-work mechanism that helps to secure the Bitcoin network",
              "That's a hilarious idea, but no, the cryptographic hash function actually ensures the opposite. Try again",
              "Ha! I'm not sure who told you that the Bitcoin blockchain was created by AI, but I think they might have been pulling your leg. Try again!",
            ],
            question:
              "What is the purpose of the cryptographic hash function in the Bitcoin blockchain",
            text: "The Bitcoin blockchain is a distributed database that maintains a continuously growing list of Bitcoin transactions called blocks.\n\nBlocks are anchored to each other through the use of cryptographic hashes. Each block contains a cryptographic hash of the previous block, as well as a timestamp and transaction data. This creates a chain of blocks that are all linked together, with each block building on the one before it.\n\nThe cryptographic hash function ensures that once a block has been added to the chain, it cannot be altered or replaced without also changing all of the subsequent blocks in the chain.\n\nThis creates a tamper-evident record of all transactions that have occurred on the blockchain, which can be used to verify the integrity of the data stored on the chain.\n",
            title: "What is a blockchain exactly?",
          },
          privateKey: {
            answers: [
              "To sign transactions and prove ownership of Bitcoins",
              "To verify the ownership of a Bitcoin address",
              "To make a stranger fall in love by posting it on social media",
            ],
            feedback: [
              "Correct! The private key is used to sign transactions and prove ownership of Bitcoins. It's an essential part of the process of sending and receiving Bitcoin payments, and it's important to keep it secret and secure. Good job",
              "Almost. **** While the private key can be used to verify the ownership of a Bitcoin address, that's not its primary purpose",
              "Posting it on social media would be like posting your bank account login information online - it's a surefire way to get your Bitcoins stolen. Better stick to more traditional methods of winning someone's heart!",
            ],
            question: "What is the purpose of the private key in a Bitcoin transaction",
            text: "Another cornerstone of Bitcoin is Public Key Cryptography that uses a pair of keys - a public key and a private key - to sign transactions and verify the ownership of Bitcoin addresses.\n\nThe private key is a long string of characters that is used to authorize Bitcoin transactions. It is often represented as a combination of 12 words (sometimes 24). Only in the correct order do the words result in the corresponding private key.\n\nWhoever knows the private key of a bitcoin address can control the bitcoin in that address. Therefore it is important that it is kept secret and never shared with anyone. Ideally, it should be stored offline, so that no unwanted program can access it. \n",
            title: "Public Key Cryptography",
          },
          publicKey: {
            answers: [
              "To generate an unlimited number of Bitcoin addresses from a single key",
              "To authorize Bitcoin transactions",
              "To verify that the supply of all bitcoin in existence does not exceed 21 million",
            ],
            feedback: [
              "Correct! It's worth noting that, while funds can only be moved with the private key, it might be a good idea to not share the master public key on a public forum to preserve financial privacy. Only share Bitcoin addresses with payers to receive payments",
              "No, the master public key is not used to authorize Bitcoin transactions. That's the job of the private key. Try again",
              "No. While every user can independently verify the monetary supply of in the bitcoin network with a bitcoin node, this is not what the master public key is used for. Try again.",
            ],
            question: "What is the purpose of a master public key in Bitcoin",
            text: "A master public key in Bitcoin is a key that is cryptographically derived from a Bitcoin private key and is used to generate Bitcoin addresses that payers can send Bitcoin to.\n\nIt can be used to generate an unlimited number of Bitcoin addresses from a single master public key.\n\nWhile the private key is used to authorize Bitcoin transactions and therefore needs to be kept private, the Bitcoin addresses derived from the public key can be shared with a payer to receive payments from them.\n\nMaster public keys consist of a long sequence of numbers and letters and begin with xpub, ypub or zpub.\n\nA Bitcoin address for receiving payments starts with either 1, 3 or bc1.\n",
            title: "Bitcoin Addresses and the Master Public Key",
          },
          mining: {
            answers: [
              "To add transactions to the blockchain and secure the network",
              "To make a lot of money",
              "To amass giant amounts of computation power for AI to take over the world",
            ],
            feedback: [
              "Correct! Miners perform work in the form of computations and compete with other miners for who can add the next block of transactions to the blockchain and earn the block reward",
              "That's not the main purpose of mining. **** While it's true that miners do receive a reward in bitcoin for their efforts, they also have to pay for the electricity they use to perform computations. Try again",
              "Wow, that's an ambitious goal! While it's true that mining requires a significant amount of computational power, I'm pretty sure the main purpose is not to create an army of AI overlords. Better luck next time!",
            ],
            question: "What is the main purpose of mining in the bitcoin network",
            text: "When a user wants to send a transaction in the bitcoin network, they need to sign the transaction with their private key to prove that they are the owner of the funds being transferred. Once the transaction is signed, it is broadcasted to the peer-to-peer network.\n\nMining is the process of adding transactions to the bitcoin blockchain. When a transaction is broadcasted to the network, it is picked up by miners, who verify that the transaction is valid (i.e., the user has the necessary funds and the private key used to sign the transaction corresponds to the public key associated with the funds).\n\nOnce a transaction has been verified, it is added to a block of transactions, along with a mathematical puzzle. Miners compete to solve the puzzle, and the first one to solve it gets to add the block to the blockchain and claim a reward in bitcoin. The reward is currently 3.125 bitcoins, plus any transaction fees that were included in the block.\n\nIn addition to adding transactions to the blockchain, mining also serves to secure the bitcoin network. This is because solving the puzzle requires a significant amount of computational power, and adding a block to the blockchain requires other miners to verify the solution. This makes it very difficult for any one person or group to manipulate the blockchain.\n",
            title: "Mining",
          },
          proofOfWork: {
            answers: [
              "Through proof of work, which involves miners competing to solve a mathematical puzzle",
              "By holding a lottery among all those that have bitcoins in a wallet",
              "Through a process of majority voting",
            ],
            feedback: [
              "Correct! Congrats on understanding how the bitcoin network creates a source of truth that cannot be manipulated by wealthy elites or insiders",
              "No, this would be proof of stake, which is a different consensus mechanism that involves choosing the next block producer proportional to their stake (how many coins they hold) in the network. Try again",
              "Wrong, but it's an interesting idea. The bitcoin network does not use a process of majority voting to create a source of truth. Try again!",
            ],
            question:
              "How does the Bitcoin network create a source of truth despite having no central authority",
            text: "Decentralized systems, by definition, do not have a single source of truth.\n\nSatoshi's breakthrough was to build a system that allows all participants to zero in on the same truth independently. Proof of work is what allows this to happen. The point of proof of work is to create an irrefutable history. If two histories compete, the one with the most work embedded in it wins.\n\nThe chain with the most work is the truth, by definition. This is called Nakamoto consensus. This works because work requires energy. In Bitcoin, work is computation. Not any kind of computation, but computation that has no shortcut: guessing.\n\n  In the absence of a central authority, proof of work is necessary because it ensures that there is no shortcut to adding transactions to the blockchain.\n\n  Miners must compete to solve the puzzle through brute force computation, which is probabilistic in nature, and the proof that the work has been done becomes self-evident in the outcome of the work. This makes it very difficult for any one person or group to manipulate the transaction history.\n",
            title: "Proof of Work",
          },
          difficultyAdjustment: {
            answers: [
              "It adjusts every 2 weeks to maintain a steady block time of 10 minutes",
              "It adjusts once a year based on market price",
              "It is randomly changed by miners through consensus",
            ],
            feedback: [
              "That's right! The Bitcoin software automatically adjusts the mining difficulty every 2016 blocks—roughly every two weeks—to target a steady pace of one block every 10 minutes. This is one of the most elegant features of the protocol.",
              "Not quite. While price does influence how many miners are active, the difficulty adjustment has nothing to do with price. It is based solely on time—specifically, how long it took to mine the last 2016 blocks. Try again!",
              "Nice try, but no. Miners can't randomly change difficulty. It's baked into the protocol and happens automatically. This prevents manipulation and ensures a consistent issuance schedule. Try again!",
            ],
            question:
              "How does the Bitcoin network ensure that new blocks are added roughly every 10 minutes?",
            text: 'Another critical component of the Bitcoin network is the "Difficulty Adjustment"—an automatic recalibration mechanism that ensures blocks are found at a regular interval of about 10 minutes, regardless of how many miners are participating.\n\nEvery 2016 blocks—roughly every two weeks—the Bitcoin software checks how long it took to mine the previous batch. If blocks were being mined too quickly, it makes the cryptographic puzzle more difficult. If they were too slow, it makes the puzzle easier. This keeps the issuance of new bitcoin on a predictable schedule.\n\nThis mechanism is unlike anything in the physical world. For example, when more gold miners join the hunt for gold, the supply increases. In Bitcoin, more miners simply increase network security, not the issuance rate. The Difficulty Adjustment is what keeps the Bitcoin machine ticking on time.',
            title: "Difficulty Adjustment",
          },
          halving: {
            answers: [
              "It is reduced by half",
              "It is doubled",
              "It is multiplied by a random number chosen by the bitcoin software",
            ],
            feedback: [
              "That's right! Satoshi determined the reduction of new bitcoin supply by half in the very first release of the Bitcoin software in 2009 and it is practically impossible to change",
              "Sorry, but the block reward is not doubled every four years. You must be confusing Bitcoin with the supplies of fiat currencies which are ever expanding at a faster rate. Try again",
              "Very creative, but wrong. The Bitcoin supply schedule is anything but random. Its predictability provides certainty for economic actors unlike anything in the history of mankind. Try again!",
            ],
            question:
              "What happens to the block reward in the bitcoin network every four years",
            text: 'One final element that is important to understand, is that the block reward in the bitcoin network is reduced by half every four years, or every 210,000 blocks.\n\nThis event, known as the "halving", is programmed into the bitcoin software that all users run. When bitcoin was first launched, miners received 50 new bitcoins for each block they added to the blockchain. Currently, the block reward is 3.125 bitcoins, but it will be reduced to 1.5625 bitcoins in 2028 when the next halving occurs.\n\nThese halvings will continue to take place until the year 2140, at which point the total number of bitcoins that will have been mined will be capped at 21 million. As of 2023, around 92% of all bitcoins (\\~19.3 million) have already been mined.\n\nUnlike fiat currencies, which can be inflationary, bitcoin is disinflationary in nature. This makes it more scarce than fiat and precious metals such as gold and silver, or anything else known in the universe.\n',
            title: "The Halving",
          },
        },
      },
      LightningWhatDoesItSolve: {
        title: "Lightning: What does it solve?",
        questions: {
          bitcoinDrawbacks: {
            answers: [
              "It takes too long to confirm transactions",
              "It is difficult to use",
              "It is not a trusted intermediary",
            ],
            feedback: [
              "Correct! Great job! You may be pleased to hear that solutions have been deployed to improve the settlement time of Bitcoin payments to a few seconds.&#x20",
              "Wrong! But you are forgiven, Bitcoin is actually very easy to use. Try again",
              "Wrong! But don't worry, Bitcoin actually allows anyone to send value without a trusted intermediary. Try again!",
            ],
            question: "What is a drawback of Bitcoin's design",
            text: "Bitcoin, the world's most widely used and valuable digital currency, allows anyone to send value without a trusted intermediary.\n\nThere are, however, some drawbacks to bitcoin's design which prioritizes security and decentralization at the cost of scalability.\n\nTransactions confirmed on the bitcoin blockchain take up to one hour before they are irreversible.\n\nMicropayments, or payments less than a few cents, are inconsistently confirmed, and fees render such transactions unviable on the network today.\n\nCurrently, Bitcoin's blockchain can process around 3 transactions per second. This is generally seen as an impediment for Bitcoin to become a currency that facilitates the everyday retail transactions of millions around the world.\n",
            title: "Drawbacks of Bitcoin",
          },
          blocksizeWars: {
            answers: [
              "Whether or not to increase the blocksize",
              "Whether or not to censor certain transactions",
              "Whether or not to change the consensus algorithm to proof of stake",
            ],
            feedback: [
              "Correct. The users ultimately prevailed in preserving the decentralization and censorship-resistance of the Bitcoin network, showing that Bitcoin is controlled by users, not corporations",
              "Not quite. Both sides were publicly in favor of preserving censorship-resistance, however companies in the Bitcoin ecosystem were willing to accept some centralization in exchange for quick wins in scalability. Try again",
              "Haha, but no. While there are some dubious voices that demand the abolishment of proof of work in favor of proof of stake, this was never a debate in Bitcoin, and never will be. Try again.",
            ],
            question: "What was the contention in the Blocksize Wars",
            text: "These drawbacks lead to a debate within the Bitcoin community about the best way to scale the Bitcoin network, often dubbed the Blocksize Wars.\n\nCompanies in the Bitcoin ecosystem argued that increasing the blocksize, which is the maximum size of a block of transactions on the blockchain, would allow more transactions to be processed per second, making the network more efficient and able to handle a larger volume of transactions.\n\nBitcoin users on the other side of the debate argued that increasing the blocksize would centralize the network, as it would require more expensive and powerful computers to process the larger blocks, and could potentially lead to Bitcoin becoming prone to censorship.\n\nThe users ultimately prevailed in preserving the decentralization and censorship-resistance of the Bitcoin network and demonstrated that Bitcoin is controlled by users, not corporations. This also meant that scaling Bitcoin would require a different enigneering solution than merely increasing the blocksize.\n",
            title: "The Blocksize Wars",
          },
          lightningNetwork: {
            answers: [
              "It allows users to make small, near instant payments at low cost",
              "It helps users preserve the decentralization of the Bitcoin network",
              "It ensures that every transaction is added to the Bitcoin blockchain",
            ],
            feedback: [
              "Correct! The Lightning Network allows users to make small, near instant payments at low cost, and it eliminates the need for every transaction to be added to the Bitcoin blockchain. Congrats! As a fun fact, the Lightning Network has helped increase the adoption of Bitcoin by allowing it to process more transactions per second and handle higher volumes of transactions",
              "Incorrect! The Lightning Network is actually a scaling solution built on top of the Bitcoin protocol. Try again",
              "Incorrect! The Lightning Network actually eliminates the need for every transaction to be added to the Bitcoin blockchain, as it allows for smaller payments to be made off-chain.",
            ],
            question: "What does the Lightning Network do",
            text: "While users prevailed and preserved the decentralization of the Bitcoin network, a solution to scale Bitcoin proposed by researchers Tadge Dryja and Joseph Poon, called the Lightning Network, started to gain traction and was launched in 2017.\n\nThe Lightning Network, often referred to as just Lightning or LN, is a scaling solution built on top of the Bitcoin protocol. It facilitates smaller, near instant payments between users at very low cost and eliminates the need for every transaction to be added to the Bitcoin blockchain whilst ensuring that the value being transacted abides by the rules of the Bitcoin network.\n",
            title: "The Lightning Network",
          },
          instantPayments: {
            answers: ["A matter of seconds", "10 minutes", "1 hour"],
            feedback: [
              "Correct! This makes the Lightning Network a great option for situations where you need to make a payment immediately, such as retail transactions or peer-to-peer payments",
              "Incorrect! On the Bitcoin network, transactions are grouped into blocks that are added to the blockchain about every 10 minutes. However, on the Lightning Network, payments do not need to wait for block confirmations to be considered secure. Try again",
              "Incorrect! On the Bitcoin network, payments are considered secure after they have been confirmed by six blocks, or about an hour. However, on the Lightning Network, payments do not need to wait for block confirmations to be considered secure.",
            ],
            question:
              "How long does it take for a payment to be considered secure on the Lightning Network",
            text: "In the Bitcoin network, transactions are grouped together in blocks, and new blocks are added to the blockchain about every 10 minutes. When a payment is made using Bitcoin, it is considered secure after it has been confirmed by six blocks, or about an hour.\n\nOn the Lightning Network, payments do not have to wait for block confirmations to be considered secure. Instead, they are instant and completed all at once in a matter of few seconds.\n\nThis makes it possible to use the Lightning Network for retail transactions, peer-to-peer payments, or any other situation where you need to make a payment immediately.\n",
            title: "Instant Payments",
          },
          micropayments: {
            answers: [
              "A payment for a small amount of money, often less than a dollar",
              "A payment that requires a minimum amount and fixed fee",
              "A payment made using the Lightning Network",
            ],
            feedback: [
              "Exactly! These types of payments can be difficult to make using traditional financial systems or the Bitcoin network, as they often have minimum amounts that can be transferred and fixed fees that can make small payments impractical",
              "Nope**.** While traditional financial systems may require a minimum amount and fixed fee for payments, the Lightning Network allows for the possibility of making very small payments without these limitations",
              "Not quite! While the Lightning Network does allow for the possibility of making micropayments, a micropayment is not defined as a payment made using the Lightning Network. Try again!",
            ],
            question: "What is a micropayment",
            text: 'Micropayments refer to very small financial transactions, often for amounts less than a dollar. These types of payments can be difficult to make using traditional financial systems, as they often have minimum amounts that can be transferred and fixed fees that can make small payments impractical.\n\nThe Lightning Network allows for the possibility of making micropayments using Bitcoin. It enables users to send very small amounts of Bitcoin, down to 1 sat, without the risk of losing control of their funds to a third party (called "custodial risk").&#x20;\n\nIn contrast, the Bitcoin blockchain currently has minimum transaction amounts and fees that make micropayments impractical. The Lightning Network allows for minimal payments denominated in Bitcoin, using actual Bitcoin transactions. This opens up the possibility of creating new markets and making small payments more practical.\n',
            title: "Micropayments",
          },
          scalability: {
            answers: [
              "To meet the demand for retail and automated payments",
              "To make Bitcoin more attractive to investors",
              "To get the required licences for interoperability with financial institutions",
            ],
            feedback: [
              "That's right. The Lightning Network helps the Bitcoin network achieve scalability by allowing users to conduct nearly unlimited transactions off-chain on a second layer",
              "That's not it! While improving the attractiveness of Bitcoin to investors could be a benefit of improving scalability, it is not the main reason why scalability is important for the Bitcoin network",
              "Try again! **** Obtaining required licenses for interoperability with financial institutions may be a goal for some organizations working with Bitcoin, but it is not directly related to the concept of scalability.",
            ],
            question: "Why is scalability important for the Bitcoin network",
            text: "Scalability refers to the ability of a system, such as a network or platform, to handle a large amount of usage or traffic without experiencing issues or slowdowns.\n\nScalability is important for Bitcoin because the network will need to be able to support a much higher volume of transactions in order to meet the demand of retail and automated payments.\n\nThe Lightning Network allows users to conduct nearly unlimited transactions between each other outside of the Bitcoin blockchain, or off-chain.\n\nThis means that transactions can be conducted without the need for each one to be recorded on the blockchain, which helps to reduce the load on the network and allows it to handle more transactions.\n",
            title: "Scalability",
          },
          paymentChannels: {
            answers: [
              "By pushing bitcoin from one side of the channel to the other each time a payment is made",
              "By broadcasting every transaction immediately to the Bitcoin blockchain as soon as it happens",
              "By paying a commission to a 3rd party payment provider",
            ],
            feedback: [
              "That's right! Think of moving bitcoin in a Lightning channel like moving beads on an abacus. Each side keeps track of how much is on their side until it's time to settle on the Bitcoin blockchain. Good job",
              "Quite the opposite! Payment channels in Lightning avoid broadcasting every transaction by aggregating them. Try again",
              "Uhm no, actually payments in Lightning Network save the users fees for not settling every transaction on the blockchain. Try again!",
            ],
            question:
              "How do payment channels in the Lightning Network allow users to pay each other",
            text: "The Lightning Network consists of thousands of two party payment channels.\n\nYou may think of a Lightning channel like opening a tab at your local bar. Instead of pulling out your wallet and paying each time you order a drink, it makes sense to save time, energy and fees by tallying all your drinks together at the end of the night and making the final settlement in one payment.\n\nLightning works similar. Each time a payment is made from person A to person B, bitcoin are pushed from one side of the channel to the other. Two users can pay one another back and forth as many times as they like, almost instantly and with close to no fees.\n",
            title: "How does Lighning work?",
          },
          routing: {
            answers: [
              "By using a network of intermediaries to route payments between users",
              "By using teleportation to instantly transfer bitcoin from one user to another",
              "By using a virtual reality simulation to simulate the transfer of bitcoin between users",
            ],
            feedback: [
              "Correct! This is like delivering a package from one person to another by passing it along a series of friendly postmen! Congrats",
              "Hah no, this isn't science-fiction from Star Trek, but real world cryptographic engineering! Try again",
              "May I interest you for a simulation of a simulation? Jokes aside, this isn't it. Try again!",
            ],
            question:
              "How does the Lightning Network allow users to pay each other if they are not directly connected through a payment channel",
            text: "You may be thinking that setting up a payment channel with hundreds of businesses could be tedious, but no. The beauty of the Lightning Network is that it is a network of channels stitched together.\n\nLet us say Bob convinced his friend Carol to also join the Lightning Network. Alice has a channel with Bob, and Bob has a channel with Carol. Alice and Carol can then pay each other by “routing” through Bob.\n\nSome pretty clever cryptographic tricks guarantee that Bob cannot steal the money while it’s passing through him.\n\nWhen you make a payment on the Lightning Network, your node searches for a path of channels between you and your destination. This is what’s referred to as routing. This is of course all done automatically by the involved Lightning nodes, enabling it to happen in the blink of an eye.\n",
            title: "Routing",
          },
        },
      },
      BitcoinCriticismsFallaciesI: {
        title: "Bitcoin Criticisms & Fallacies I",
        questions: {
          itsaBubble: {
            answers: [
              "It has consistently gone up",
              "It has consistently gone down",
              "It has gone up and down randomly",
            ],
            feedback: [
              "Well done! You seem to have a good grasp on the overall trend of bitcoin's exchange rate. Despite some fluctuations, it has consistently been on the rise. Keep up the good work",
              "I'm sorry, that's not quite right. While the exchange rate of bitcoin has certainly had its ups and downs, the overall trend has not been consistently downward. Try again",
              "Sorry, that's incorrect. While the exchange rate of bitcoin has certainly had its ups and downs, the overall trend has not been completely random. Keep trying!",
            ],
            question: "How has the exchange rate of bitcoin trended over time",
            text: "Over the years, bitcoin has often been called a bubble by various people. While its price has had several significant declines that may have warranted this label, the overall trend for bitcoin has been consistently upward.\n\nCritics who have proclaimed the death of bitcoin after each market cycle have been proven wrong, as the nascent digital money has continued to thrive despite their predictions. As these critics run out of analogies to use, it has become clear that their accusations are unfounded.\n",
            title: "Is bitcoin a bubble?",
          },
          itstooVolatile: {
            answers: [
              "Buyers and sellers reaching agreements in real-time",
              "Government intervention",
              "The phase of the moon",
            ],
            feedback: [
              "You're correct! The primary factor influencing the volatility of bitcoin's price is actually the agreements reached in real-time between buyers and sellers",
              "I'm sorry, that's not quite right. While government intervention can certainly affect the price of bitcoin, it is not the primary factor influencing its volatility",
              "Sorry, that's incorrect. While the phase of the moon may have some strange effects on certain things, it does not play a significant role in the volatility of bitcoin's exchange rate. Keep trying!",
            ],
            question:
              "What is the primary factor influencing the volatility of bitcoin's exchange rate",
            text: "It is subjective to expect bitcoin to maintain a specific price range, as it is traded around the clock, every day of the year, across the world. There are no requirements for registration, bank holidays, circuit breakers, or bailouts in the bitcoin market, which operates as a truly free market.\n\nAny and all volatility in bitcoin's price is the result of buyers and sellers reaching agreements in real-time without interference from governments. As bitcoin continues its journey towards becoming a primary global store of value in the Information Age, it is unrealistic to assume that its progress would be linear.\n\nAs adoption of bitcoin increases, it becomes less risky and potential upside decreases, leading to a decrease in volatility.\n",
            title: "It's too volatile!",
          },
          itsnotBacked: {
            answers: [
              "The credibility of its monetary properties",
              "Rarity",
              "The color purple",
            ],
            feedback: [
              "Spot on! According to Parker Lewis, the only thing that backs any money is the credibility of its monetary properties",
              "That's not quite right. While rarity can certainly contribute to the value of money, it is not the only thing that backs it. Try again",
              "That's incorrect. While the color purple may be a beautiful and regal choice for a currency, it does not actually play a role in backing money.",
            ],
            question:
              "What is the only thing that backs any money, according to Parker Lewis",
            text: 'The idea of backed money is contradictory, as the backing itself would then be considered money. Part of the value of money comes from its rarity. Bitcoin does not need to be backed by something else that is rare because it is inherently scarce.\n\nVerifiable and auditable through independent means, bitcoin is free of counterparty risk. There is no third party that must be trusted to keep and secure commodities or assets. If anything, it is possible that the future will be backed by bitcoin.\n\nAs Parker Lewis stated, "Ultimately, bitcoin is backed by something, and it\'s the only thing that backs any money: the credibility of its monetary properties."\n',
            title: "Should money be backed by something?",
          },
          willbecomeObsolete: {
            answers: [
              "No, it is not possible for bitcoin to become obsolete because it represents absolute scarcity and has a dominant position in the market.",
              "Yes, it is possible that bitcoin could become obsolete if a more secure or widely used digital monetary network is developed.",
              "that, but let's be real here - who's going to invent a digital currency that's more scarce than absolute scarcity? That's like trying to invent a circle that's rounder than round. Good luck with that",
            ],
            feedback: [
              "bitcoin to become obsolete because it represents absolute scarcity and has a dominant position in the market.",
              "Well, you're not wrong about that, but let's be real here - who's going to invent a digital currency that's more scarce than absolute scarcity? That's like trying to invent a circle that's rounder than round. Good luck with that",
              "Uh oh, looks like you're playing it safe but not quite hitting the mark. While it's true that no one can predict the future, it's pretty clear that bitcoin has a solid grip on the digital monetary network game. Try again.",
            ],
            question: "Is it possible that bitcoin becomes obsolete one day",
            text: "Bitcoin represents a unique discovery of absolute scarcity, similar to the discovery of fire, electricity, or the field of mathematics.\n\nIt is not logical or possible to compete with bitcoin in terms of scarcity, as there is no level of scarcity higher than absolute scarcity. Criticisms of bitcoin's perceived limitations or drawbacks assume that there are no trade-offs in terms of security and incentive design, or that bitcoin's current form does not already provide significant benefits to millions of users.\n\nAs a rapidly growing, unrestricted network with a 99.98% uptime over more than a decade, having processed trillions of dollars in value and secured by billions of dollars in hardware, it is unlikely that bitcoin will be displaced as the dominant digital monetary network at this point.\n\nAs Michael Saylor stated, \"There's never been an example of a $100B monster digital network that was vanquished once it got to that dominant position.\"\n",
            title: "Will bitcoin become obsolete one day?",
          },
          toomuchEnergy: {
            answers: [
              "It helps to even out the distribution of energy consumption around the world.",
              "It increases the distribution of energy consumption around the world.",
              "It decreases the distribution of energy consumption around the world.",
            ],
            feedback: [
              "You got it right. Did you know that bitcoin's fixed energy price helps to incentivize the use of renewable energy sources in areas where they may not have been economically viable before",
              "Well, I see you're a fan of chaos and global energy inequality, but this answer is wrong",
              "Looks like you're trying to save the world one energy imbalance at a time. This answer is clearly incorrect.",
            ],
            question: "How does bitcoin impact global energy consumption",
            text: "Bitcoin is a decentralized digital currency that is accessible to users around the world and is resistant to censorship due to its Proof of Work mechanism.\n\nWith an estimated four billion people currently living under authoritarianism, bitcoin provides a way for individuals to send, receive, save, and transport wealth. It is important to consider the amount of energy that a monetary network like this should consume and to carefully evaluate who is best equipped to make decisions about this.\n\nOne way to think about the impact of bitcoin on global energy consumption is to imagine a topographic map of the world, with local electricity costs represented by the peaks and troughs. Adding bitcoin to the mix is like pouring a glass of water over the map - it settles in the troughs, smoothing them out. This is because bitcoin is a global buyer of energy at a fixed price, which helps to even out the distribution of energy consumption around the world.\n",
            title: "Is bitcoin's energy consumption excessive?",
          },
          strandedEnergy: {
            answers: [
              "By using it to power onsite equipment that generates hashes to produce bitcoin",
              "By selling it on the bitcoin market",
              "By creating a new form of renewable energy",
            ],
            feedback: [
              "Congratulations! You've correctly identified the use of excess energy in bitcoin mining. Did you know that this process can be done in any location, even in areas where there is no local demand for the energy being generated",
              "I see you're a fan of making money through unconventional means. Too bad that's not what this lesson is about. Try again",
              "It looks like you're trying to save the world one renewable energy source at a time. While that's admirable, unfortunately that's not the right answer.",
            ],
            question: "How can excess energy be used through bitcoin mining",
            text: "Exactly**.** Bitcoin mining provides a portable solution for utilizing energy assets in regions where there is no local demand or means of transportation. By using onsite equipment to generate hashes, it is possible to produce bitcoin, which can then be held for future value appreciation or sold on the highly liquid and globally accessible bitcoin market.\n",
            title:
              "Wait, are you telling me that bitcoin can be used to tap into stranded energy?",
          },
        },
      },
      BitcoinCriticismsFallaciesII: {
        title: "Bitcoin Criticisms & Fallacies II",
        questions: {
          internetDependent: {
            answers: [
              "By sending a transaction via SMS",
              "By posting a message on a social media platform",
              "By sending an email",
            ],
            feedback: [
              "You've identified a way to send bitcoin transactions even when the internet is down. Good thinking",
              "Well, it looks like you're trying to stay connected in the digital age even during an internet outage, but that's incorrect",
              "I see you're trying to stay connected through traditional means, but unfortunately sending an email might not be the most reliable way to send bitcoin transactions during an internet outage. Try again!",
            ],
            question:
              "How can bitcoin transactions be sent in the event of an internet disruption",
            text: "There is a risk, of course, that internet access may be lost due to infrastructure failures, natural disasters, or intentional outages. However, it is possible to transact bitcoin using offline methods and other communication networks.\n\nFor instance, a signed bitcoin transaction can be transmitted to a single node and broadcast to the network for inclusion in a block by miners. There are various ways to do this, such as sending a transaction via SMS, using a physical wallet with a one-time use tamper-evident private key, or receiving blocks via satellite. These options allow for bitcoin to be used even in the event of an internet disruption.\n",
            title: "Bitcoin is too dependent on the Internet",
          },
          forcrimeOnly: {
            answers: ["No", "Yes", "It depends on the individual circumstances"],
            feedback: [
              "Well done! You've correctly identified that it is not accurate to claim that bitcoin's properties have led to an overall increase in criminal activity.",
              "I see you're a fan of sensational headlines and jumping to conclusions. Unfortunately, that's not based in reality",
              "It looks like you're trying to take a balanced approach, but is not accurate to make this claim regardless of individual circumstances. Try again.",
            ],
            question:
              "Is it accurate to claim that bitcoin's properties have led to an overall increase in criminal activity",
            text: 'Bitcoin is a neutral tool for exchanging value, and it has no inherent beliefs, opinions, or values. Its meaning is determined by how it is used. It is not accurate to claim that bitcoin\'s properties have led to an overall increase in criminal activity.\n\nCrime does not stem from access to tools, but rather from individual circumstances. If bitcoin is useful, it can be used by anyone, including criminals. If it is not useful, it cannot be used by anyone, including criminals.\n\nAs Parker Lewis stated, "There is nothing inherent about the tools used to facilitate crimes that makes them criminal in themselves. Despite criminal use, no one is calling for the ban of roads, the internet, mail, etc."\n',
            title: "Bitcoin is for Criminals",
          },
          ponziScheme: {
            answers: [
              "It is a form of money",
              "It is a ponzi scheme",
              "It is an open-source investment scheme",
            ],
            feedback: [
              "Congratulations! You've earned some sats for correctly identifying that bitcoin is a form of money. Did you know that bitcoin was the first decentralized digital currency to be created, and it operates without a central bank or single administrator",
              "Ah hah! You fell for the old ponzi scheme trick! Just kidding, but seriously, that's not what bitcoin is",
              "Nope, sorry! Bitcoin isn't an open-source investment scheme. But hey, at least you're learning about it, right?",
            ],
            question: "Which of the following statements is true about bitcoin",
            text: "Calling bitcoin a ponzi scheme shows a lack of understanding of both bitcoin and the definition of a ponzi scheme. A ponzi scheme involves promises of above-market returns to investors, but as a permissionless network, bitcoin does not have a central authority that can make such promises.\n\nAdditionally, bitcoin is not an investment scheme, it is a form of money. Unlike opaque investment opportunities that may be promoted to unsuspecting individuals, bitcoin's code is open-source and its supply can be independently verified at all times.\n",
            title: "Bitcoin is a Ponzi Scheme",
          },
          bitcoinisTooSlow: {
            answers: [
              "Credit card payments go through multiple parties before reaching the merchant, while bitcoin payments go directly to the recipient without intermediaries",
              "Credit card payments are final once they are confirmed, while bitcoin payments can be reversed",
              "but at least you're learning about bitcoin",
            ],
            feedback: [
              "Congratulations! You've unlocked the ultimate bitcoin payment mastery. You seem to understand that bitcoin operates without a central bank or single administrator",
              "Uh oh, looks like you might have gotten the wrong answer, but at least you're learning about bitcoin",
              "Nope, sorry! Credit card payments are being censored all the time, but good try. Keep learning about bitcoin!",
            ],
            question:
              "What is the main difference between paying with a credit card and paying with bitcoin on-chain",
            text: 'Paying with bitcoin is not the same as using a credit card to make a purchase. When you use a credit card, your payment goes through multiple parties before reaching the merchant\'s bank account after days or even weeks of processing.\n\nIn contrast, when you pay with bitcoin on the main blockchain, you are sending actual money directly to the recipient without any intermediaries. This means there is no risk of censorship and the transaction is considered final once it has been confirmed by six blocks on the blockchain.\n\nThe proper comparison would be between bitcoin base layer and the Fed as currency issuer and as a clearing mechanism.\n\nSince the advent of the Lightning Network, the "Bitcoin is too slow" criticism has largely fallen silent.\n',
            title: "Bitcoin is too slow",
          },
          supplyLimit: {
            answers: [
              "Through a decentralized consensus process in which every transaction is independently validated by nodes on the network",
              "Through a centralized process in which a single authority controls the issuance of new coins",
              "By fixing the maximum supply at an arbitrary number, such as 100 million",
            ],
            feedback: [
              "Congratulations! You've unlocked the ultimate bitcoin supply mastery. Did you know that the decentralized nature of the bitcoin network allows for greater transparency, as every transaction is independently validated by nodes on the network",
              "Nope, sorry! Bitcoin's supply isn't controlled by a central authority. Try again",
              "Uh oh, looks like you might have gotten the wrong answer. The maximum supply of bitcoin is fixed at 21 million, not 100 million. But at least you're learning about bitcoin!",
            ],
            question: "How is the supply of bitcoin protected from being corrupted",
            text: "Bitcoin's decentralized nature allows for its supply to be independently validated by each node on the network, ensuring that it cannot be corrupted. This is achieved through a consensus process in which every transaction that has been confirmed on the bitcoin network is independently validated.\n\nWhile anyone can fork the code and make changes to the rules, it is unlikely that this version of the code would be adopted by the wider network. The decentralized consensus process and the incorruptible supply of bitcoin are crucial to its appeal as a form of money.\n\nThe maximum supply of bitcoin is fixed at 21 million, and any attempt to increase this limit would require consensus from a significant portion of the bitcoin network, which is highly unlikely to happen.\n",
            title: "Bitcoin's Supply Limit Could Be Corrupted",
          },
          governmentBan: {
            answers: [
              "No, because the decentralized nature of the bitcoin network makes it difficult to enforce a ban",
              "Yes, by preventing the generation of random numbers",
              "Yes, by shutting down the internet",
            ],
            feedback: [
              "Correct. The decentralized nature of the bitcoin network makes it difficult to enforce a ban",
              "Nope, silly! While it is technically possible for governments to ban bitcoin, it would be nearly impossible to enforce such a ban. Try again",
              "Uh oh, looks like you might have gotten the wrong answer. Shutting down the internet wouldn't necessarily stop people from using bitcoin.",
            ],
            question: "Can governments effectively ban bitcoin",
            text: 'It is technically possible for governments to ban bitcoin, but enforcing such a ban would be difficult due to the decentralized nature of the bitcoin network.\n\nBitcoin relies on private keys, which are simply random numbers, to control access to transactions recorded on the blockchain. These private keys can be generated and stored anywhere, making them largely undectectable.\n\nAdditionally, the infrastructure required to access the bitcoin network is relatively simple and widely available, making it easy for people to trustlessly verify transactions.\n\nAs Saifedean Ammous said, "Banning bitcoin is not much different from trying to ban math. It will just prove its utility & drive more people to it."\n',
            title: "Governments Will Ban Bitcoin",
          },
        },
      },
      BitcoinCriticismsFallaciesIII: {
        title: "Bitcoin Criticisms & Fallacies III",
        questions: {
          concentratedOwnership: {
            answers: [
              "Yes, but these wallets belong to exchanges that have millions of customers",
              "Yes, and these wallets belong to individuals who have hoarded large amounts of bitcoin",
              "No, the vast majority of bitcoin is evenly distributed among a large number of users",
            ],
            feedback: [
              "Congratulations! You've unlocked the ultimate bitcoin wallet mastery. Did you know that it is generally considered best practice to keep bitcoin in a self-hosted wallet for security and privacy reasons",
              "Nope, sorry! While it is technically true that a small number of wallets hold the majority of all bitcoin, these wallets don't necessarily belong to individuals who have hoarded large amounts of bitcoin. Keep learning about bitcoin",
              "Uh oh, looks like you might have gotten the wrong answer. The distribution of bitcoin among users is not necessarily even. But at least you're learning about bitcoin!",
            ],
            question:
              "Is it true that a small number of wallets hold the majority of all bitcoin",
            text: "It is often said that a small number of wallets hold the majority of all bitcoin. While this is technically true, it is important to note that these wallets are typically owned by exchanges that have millions of customers.\n\nMany people choose to leave their bitcoin on an exchange, but it is generally considered best practice to keep bitcoin in a personal wallet for security and privacy reasons.\n\nIt is also worth noting that a single bitcoin address can contain bitcoin belonging to multiple users, and a single user can control multiple wallets. To maintain privacy, it is recommended to generate a new address for each receiving transaction instead of reusing the same address.\n",
            title: "Bitcoin Ownership Is Concentrated on a Few Users",
          },
          centralizedMining: {
            answers: [
              "No, because they have a strong incentive to follow the rules of the network and maintain the integrity of the blockchain",
              "Yes, because they have a majority of the hashing power",
              "Yes, but only if they are acting in their own self-interest",
            ],
            feedback: [
              "Yep, that's right. Did you know that the decentralized nature of the bitcoin network ensures that no single entity, including mining pools, can disrupt the network or censor transactions",
              "Nope, sorry! While mining pools do have a significant amount of hashing power, individual miners are extremely mobile and can trivially direct their hashrate to an honest mining pool",
              "Incorrect. While it is true that mining pools have an incentive to act in their own self-interest, this does not mean that they can disrupt the bitcoin network or censor transactions.",
            ],
            question:
              "Can mining pools disrupt the bitcoin network or censor transactions",
            text: 'Some people believe that mining pools, which are groups of miners that work together to increase their chances of finding a block, could potentially disrupt the bitcoin network or censor transactions.\n\nHowever, this concern stems from a lack of understanding of the incentives of miners and their role in the network. In reality, miners have a strong incentive to follow the rules of the network and maintain the integrity of the blockchain, as their own profits depend on it.\n\nAs Jimmy Song said, "A majority of hashing power can\'t: take coins you already possess away, change the rules of bitcoin, or hurt you without hurting themselves."\n',
            title: "Bitcoin Mining Is Centralized",
          },
          tooExpensive: {
            answers: [
              "By comparing the entire market capitalization of bitcoin to that of other asset classes",
              "By comparing the unit price of one bitcoin to the unit price of another asset, such as gold",
              "By consulting a crystal ball and going with your gut feeling",
            ],
            feedback: [
              "Congratulations, you're on the right track! It's important to consider the entire market cap of bitcoin when comparing it to other assets. Did you know that the total market cap of bitcoin reached over $1 trillion in 2021",
              "Uh oh, it looks like you might have fallen for the unit bias trap! Better luck next time",
              "Sorry, consulting a crystal ball might work for predicting the weather, but it's not a reliable way to assess the value of bitcoin. Better luck next time!",
            ],
            question:
              "How can you accurately compare the value of bitcoin to other assets",
            text: 'One common misconception about bitcoin is that it is too expensive to purchase.\n\nHowever, this belief is based on unit bias, as it is more accurate to compare the entire market capitalization of bitcoin to other assets rather than just the unit price of a single bitcoin.\n\nIt\'s also worth noting that a single bitcoin can be divided into 100 million smaller units called satoshis. As the saying goes, "you can buy a fraction of a bitcoin!"\n',
            title: "Bitcoin is too expensive",
          },
          prohibitivelyHigh: {
            answers: [
              "The efficiency and reliability of the bitcoin network as a settlement layer",
              "The use of secondary layers such as lightning, liquid, or federated side-chains for smaller transactions",
              "The fact that bitcoin is still a relatively new technology and has not yet reached its full potential",
            ],
            feedback: [
              "Congratulations, you've hit the nail on the head! The efficiency and reliability of the bitcoin network certainly play a role in keeping transaction fees low. Did you know that the bitcoin network can process up to 7 transactions per second, making it faster than some traditional payment systems",
              "Nice try, but it looks like you're missing a key piece of information. Try again",
              "Sorry, but being a newer technology does not necessarily equate to lower transaction fees. Better luck next time!",
            ],
            question:
              "What is the main reason that transaction fees on the main layer of bitcoin remain relatively low compared to traditional financial systems",
            text: 'Another misconception about bitcoin is that its transaction costs are prohibitively high.\n\nHowever, confirmed transactions on the main layer of bitcoin provide a level of finality that is unmatched in the traditional financial system. While it is true that transaction fees may occasionally spike due to the limited capacity of each block, the bitcoin network remains an efficient and reliable settlement layer for high-value transactions.\n\nIn fact, according to Saifedean Ammous, "between October 2010 and July 2021, the average daily transaction fees came up to around 0.02% of the value of the transactions."\n\nIn addition, smaller transactions, including microtransactions, are often migrated to secondary layers such as lightning, liquid, or federated side-chains where fees are significantly lower than those offered by retail banks.\n',
            title: "Bitcoin transaction costs are prohibitively high",
          },
          willBeHoarded: {
            answers: [
              "No, holding bitcoin is a way to hedge against future uncertainty and does not necessarily mean it is not being used",
              "Yes, holding bitcoin is the same thing as hoarding bitcoin",
              "It depends on the individual's intentions and financial goals",
            ],
            feedback: [
              "Congratulations, you're on the right track! As Pierre Rochard pointed out, 'all bitcoin are always held by someone, payments only change who is holding it.' Well done",
              "Uh oh, it looks like you might have fallen for the hoarding misconception! Holding bitcoin is a common way to hedge against future uncertainty and does not necessarily mean it is not being used",
              "Sorry, but the distinction between holding and hoarding bitcoin is not dependent on an individual's intentions and financial goals. Better luck next time!",
            ],
            question: "Is holding bitcoin the same thing as hoarding bitcoin",
            text: 'There is a common belief that the fixed supply of bitcoin incentivizes hoarding, or the act of holding onto bitcoin rather than spending it in the economy.\n\nHowever, this logic has a few flaws. First, saving, or the act of setting aside income for future use, is often conflated with hoarding. In fact, saving is a necessary precursor to significant investment and can be seen as a responsible financial practice.\n\nSecond, holding onto bitcoin, or any form of money, is a common way to hedge against future uncertainty and does not necessarily mean that it is not being used.\n\nAs Pierre Rochard pointed out, "all bitcoin are always held by someone, payments only change who is holding it." In other words, the act of holding bitcoin is itself a use of bitcoin.\n',
            title: "The Misconception of Bitcoin Hoarding",
          },
          canBeDuplicated: {
            answers: [
              "The code is heavily scrutinized and rigorously developed, ensuring its security and transparency",
              'The fact that it is open source allows for a meritocracy and encourages the "hive mind" to build solutions',
              "It is backed by a large and influential group of investors",
            ],
            feedback: [
              "That's exactly right! The code of bitcoin is indeed heavily scrutinized and rigorously developed, which adds to its value. In fact, @BTCSchellingPt noted that Bitcoin Core is probably one of the most heavily scrutinized code bases in the world",
              "Nice try, but the value of bitcoin lies not only in its code but also in the community and infrastructure surrounding it. Better luck next time",
              "Sorry, the value of bitcoin is not solely determined by the backing of a group of investors. Better luck next time!",
            ],
            question:
              "What is the main reason that bitcoin is considered valuable despite the fact that its code can be copied by anyone",
            text: 'One argument against the value of bitcoin is that it is not scarce because there are thousands of other cryptocurrencies available and because anyone can copy the code and create their own version.\n\nHowever, this overlooks the fact that bitcoin is more than just a piece of code. It is an open source protocol for transferring value that attracts people and resources due to its transparency and rigorous development process.\n\nAs @BTCSchellingPt noted, "open source is very much a meritocracy. You\'ve got the hive mind building solutions. You get all that scrutiny and that comes back to security. Bitcoin Core is probably one of the most heavily scrutinized code bases in the world."\n\nIn other words, the value of bitcoin lies not only in its code, but also in the community and infrastructure that surrounds it.\n',
            title:
              "Bitcoin is not scarce because there are thousands of cryptocurrencies",
          },
        },
      },
      BitcoinAndEconomicsI: {
        title: "Bitcoin and Economics I",
        questions: {
          scarcity: {
            answers: [
              "A resource that is limited in quantity or availability and can lead to competition for possession",
              "A resource that is abundant and easy to come by",
              "A resource that can only be obtained through time travel",
            ],
            feedback: [
              "Remark:** Correct! Good job, you understood the concept of scarcity. Scarcity can lead to competition and can affect the value of goods and services in a free market",
              "Wrong! Sorry to burst your bubble, but if something is easy to come by, it can't be scarce",
              "Wrong! Time travel is a great idea for a sci-fi movie, but it doesn't have anything to do with scarce resources.",
            ],
            question: "What is a scarce resource",
            text: "When there are not enough resources to go around, people and organizations compete for them.\n\nThis competition is often reflected in the price of goods and services in a free market. If the demand for a particular resource increases faster than the supply, it can become scarce and more valuable.\n\nMoney is often used as a way to buy things because it is easy to trade and is valuable because it is scarce. Bitcoin is a digital form of money that has a fixed supply, which makes it rare and valuable.\n\nThe idea that there is never enough of something to go around is a basic principle of economics, but it is often ignored in political decisions.\n",
            title: "How limited resources are allocated and competed for",
          },
          monetaryPremium: {
            answers: [
              "The difference in value between something's use as money and its value for its other uses",
              "An extra fee added to the price of goods and services",
              "A monetary premium has nothing to do with paying extra for things",
            ],
            feedback: [
              "Congratulations! You know your stuff when it comes to monetary premiums. A monetary premium is the additional value that something can have when it is used as a substitute for money. Good job",
              "Sorry, wrong answer! A monetary premium has nothing to do with paying extra for things",
              "Nope! A monetary premium is not a discount, it's actually the opposite.",
            ],
            question: "What is a monetary premium",
            text: "If the value of money is not based on its scarcity, it may not be as reliable as a way to store wealth. In this case, other things that are scarce, such as assets or resources, may become more valuable and be used as a substitute for money.\n\nThis additional value is known as a monetary premium. When the usual form of money is not working well, people may turn to other things that are rare or hard to obtain as a way to exchange value.\n\nSome historical forms of money had no other use or value besides being used as a way to trade for other things. The difference between the value of something as money and its value for its other uses is the monetary premium.\n",
            title: "Monetary Premium",
          },
          greshamsLaw: {
            answers: [
              "A law that explains how people tend to use different types of currency in different ways when they are in circulation together",
              "A law that says people will always choose to spend the more valuable currency when given a choice",
              "Gresham's Law actually explains the opposite behavior",
            ],
            feedback: [
              "Good job, you understood Gresham's Law. This law explains how people tend to save the more valuable currency and spend the less valuable one when given the choice. Interesting fact: Gresham's Law can also apply to \"fiat\" currency, which is not backed by a physical commodity like gold or silver",
              "Sorry, wrong answer! Gresham's Law actually explains the opposite behavior",
              "Ha! That's a funny answer, but unfortunately it's not correct.",
            ],
            question: "What is Gresham's Law",
            text: 'Gresham\'s Law is a concept that explains how people tend to use different types of currency in different ways when they are in circulation together.\n\nIf two forms of currency are given equal value by a government or other authority, but one is made of a more valuable material, people will be more likely to save the more valuable currency and spend the less valuable one.\n\nThis can happen when a government debases its currency, or makes it worth less, by decreasing the amount of valuable material it contains. The result is that people lose trust in the debased currency and prefer to hold onto the more valuable one instead.\n\nThis principle can also apply to "fiat" currency, which is not backed by a physical commodity like gold or silver, if the supply of the currency is increased in a way that makes it worth less.\n\nIn recent years, the emergence of bitcoin as a digital currency has led to a trend of people saving in bitcoin and spending their traditional currency, or "fiat," more quickly. This is because bitcoin is seen as having a higher long-term value and being more stable than fiat currencies.\n',
            title: "Gresham's Law",
          },
          thiersLaw: {
            answers: [
              "A law that discusses what might happen if people and businesses refuse to accept or use a lower quality form of currency",
              "A law that says people will always choose the more valuable currency when given a choice",
              "A law that says people will always choose the less valuable currency when given a choice",
            ],
            feedback: [
              "Correct! Good job, you understood Thier's Law. This law discusses what might happen if people and businesses refuse to accept a lower quality form of currency. Interesting fact: Thier's Law suggests that if a government tries to force people to use a lower quality currency by making it legal tender, it will be ignored",
              "Wrong answer! Gresham's Law explains this behavior, not Thier's Law",
              "Sorry, try again! Thier's Law is not about always choosing the less valuable currency.",
            ],
            question: "What is Thier's Law",
            text: "Thier's Law is a concept that discusses what might happen if people and businesses refused to accept or use a lower quality form of currency.\n\nInstead of disappearing from circulation, the higher quality form of money might be traded at a premium, or for a higher value than its face value.\n\nThier's Law suggests that if a government tries to force people to use a lower quality currency by making it legal tender, it will be ignored.\n\nIn other words, people and businesses may choose not to accept the lower quality currency and instead prefer to use the higher quality one or other forms of payment.\n",
            title: "Thier's Law",
          },
          cantillonEffect: {
            answers: [
              "A phenomenon that occurs when new money is introduced into an economy, causing some prices to increase more than others and leading to an uneven distribution of wealth.",
              "A mysterious force that causes people to turn into cantaloupes whenever they eat too much fruit.",
              "A dance move that involves spinning around in circles while holding a bunch of cantaloupes.",
            ],
            feedback: [
              "Congratulations, you are correct! The Cantillon Effect is indeed a process that can influence the distribution of wealth in an economy. Good job",
              "Sorry, but the Cantillon Effect doesn't have anything to do with fruit transformation. Better luck next time",
              "Sorry, but the Cantillon Effect is not a dance move, no matter how much you love cantaloupes. Better luck next time!",
            ],
            question: "What is the Cantillon Effect",
            text: "The Cantillon Effect is a phenomenon that occurs when new money is introduced into an economy.\n\nWhen new money is added, it tends to go to certain people or businesses first, and these initial recipients have an advantage over others because they get to use the new money before prices go up.\n\nThis causes the prices of some goods and services to increase more than others, which means that the people who get the new money first benefit while those who get it later are disadvantaged.\n\nThis effect was first described by economist Richard Cantillon in the context of commodity money, such as gold and silver, but it is even more relevant today in the age of fiat money.\n\nWhen a government or central bank creates a lot of new fiat money, it can lead to increased prices and uneven distribution of wealth, as some people and businesses are able to access credit more easily and benefit from rising asset prices.\n",
            title: "The **** Cantillon Effect",
          },
          schellingPoint: {
            answers: [
              "A solution that people tend to choose by default in the absence of communication",
              "A type of point system used in online multiplayer games",
              "A point on the earth's surface where all the planet's magnetic forces are balanced",
            ],
            feedback: [
              "You got it right. Did you know that a Schelling point can occur in multiplayer cooperative games and communication networks, and can be facilitated by standardized protocols like money",
              "Wrong! But at least you're thinking about points. Maybe try again and focus on communication this time",
              "Ha! You're off by a whole planet. Maybe try again and focus on the concept of default choices in the absence of communication.",
            ],
            question: "What is a Schelling point",
            text: 'A Schelling point is a solution that people tend to choose by default, without communicating with each other.\n\nThis can happen in multiplayer cooperative games, where you have to anticipate the choices of others. If you make the wrong choice, you might face consequences or miss out on benefits.\n\nCommunication works the same way - it\'s like a multiplayer cooperative game played with others in the same network. We use standardized protocols (like email, spoken language, or money) to communicate efficiently with as many people as possible, with as little friction as possible. This can lead to increased trade, knowledge exchange, and innovation.\n\nIn the digital world, people tend to choose the same option (the Schelling point) when exchanging value. This is because they expect that others will also choose it.\n\nThe option that becomes the Schelling point is the one that communicates price signals most accurately, allowing market participants to coordinate with each other.\n\nBitcoin is a protocol for exchanging value that has several advantages over traditional currencies (called "fiat"). For example, it has a fixed supply and its value has generally increased over time, while fiat currencies often lose value. Additionally, the bitcoin network is permissionless, global, and indestructible. All of these factors make bitcoin a natural Schelling point for money.\n',
            title: "Schelling Point",
          },
        },
      },
      BitcoinAndEconomicsII: {
        title: "Bitcoin and Economics II",
        questions: {
          opportunityCost: {
            answers: [
              "The cost of not being able to do something else when you choose to do one thing",
              "A type of cost that only applies to business owners",
              "The cost of buying a new car",
            ],
            feedback: [
              "Congratulations! You got it right. Did you know that opportunity cost can help you make better financial decisions by considering the trade-offs involved in different options",
              "Wrong! Opportunity cost applies to anyone who makes a choice, not just business owners. Maybe try again and think about the trade-offs involved in decision-making",
              "Ha! That's not quite right. The cost of buying a new car is a specific type of expense, not the same thing as opportunity cost. Maybe try again and think about the concept of trade-offs in decision-making.",
            ],
            question: "What is opportunity cost",
            text: "Opportunity cost is the idea that when you choose to do one thing, you can't do something else instead. In other words, every time you make a financial decision, you have to trade off one option for another.\n\nBitcoin can help you make better financial decisions in the long term because it's a good way to store value (like saving money). This means that if you choose to invest in bitcoin, you might have to give up using that money for other things or opportunities. But if you hold onto your bitcoin, it has the potential to increase in value over time.\n\nThis is especially important right now because the traditional monetary system (called \"fiat\") is not a reliable way to save money - it's designed in a way that causes the value of money to go down over time. So, it's important to make careful financial decisions to preserve your wealth.\n",
            title: "Opportunity Cost",
          },
          timePreference: {
            answers: [
              "The amount of value you place on the present versus the future",
              "A preference for doing things at a specific time of day",
              "A preference for traveling through time",
            ],
            feedback: [
              "Congratulations! You got it right. Did you know that there are many factors that can influence your time preference, such as personal safety, tax rates, property rights, and the ability to store value reliably",
              "Wrong! Time preference has to do with decision-making, not a specific time of day. Maybe try again and think about how the time horizon you're operating on can affect your choices",
              "Ha! Time travel is still just science fiction, sorry. Maybe try again and think about how the time horizon you're operating on can affect your choices.",
            ],
            question: "What is time preference",
            text: 'Time preference is the idea that the amount of time you have to wait for something to happen can affect the decisions you make.\n\nFor example, if you value the present more than the future, you might be more likely to choose something that gives you immediate gratification.\n\nOn the other hand, if you value the future more, you might be willing to wait longer for something that has a bigger benefit in the long term.\n\nThere are many factors that can influence your time preference, such as your personal safety, tax rates, property rights, and the ability to store value reliably.\n\nThe "hardness" of money (how well it holds its value over time) is also important because it can encourage people to save, plan, and invest for the future. It\'s important to note that time preference is not a fixed thing - it can change based on the incentives in your environment.\n',
            title: "Time Preference",
          },
          impossibleTrinity: {
            answers: [
              "As perfectly mobile capital, Bitcoin alters the logic of sovereign nations to direct international monetary policy by making capital controls impossible to enforce.",
              "Due to its fixed supply, the existence of Bitcoin makes it easier for sovereign nations to set fixed exchange rates.",
              "Governments will restrict discussion of the Mundell-Fleming Trilemma because speech is easier to censor than cross-border payments.",
            ],
            feedback: [
              "enforce.",
              "The 21 million cap is indeed quite fascinating, but the existence of Bitcoin actually makes it more difficult for nations to set fixed exchange rates. Try again",
              "While that's entirely possible of course, that's not the most likeliest outcome here. Try again!",
            ],
            question:
              "How does the existence of Bitcoin affect the Mundell-Fleming-Trilemma?",
            text: "The Impossible Trinity, also known as the Mundell-Fleming Trilemma, is a concept that explains the trade-offs involved in setting international monetary policy for a sovereign nation.\n\nIt says that a country can only choose two of the following three options: fixed exchange rates, free capital flows, and independent monetary policy.\n\n  These three options cannot be pursued at the same time. This is because a country's capital flows, or the movement of money in and out of the country, can be influenced by the value of its currency and its monetary policy, which sets the rules for how much money is in circulation.\n\n  As capital becomes more mobile and can move freely across borders, it is harder for a country to control and direct its capital flows. The rise of bitcoin, a digital currency that is borderless and immune to changes in value, may further challenge a country's ability to set monetary policy.\n",
            title: "The Impossible Trinity",
          },
          jevonsParadox: {
            answers: [
              "The phenomenon of increased consumption of a resource due to increased efficiency",
              "A type of fruit named after an economist",
              "A paradox that states that the more we have of something, the less we want it",
            ],
            feedback: [
              "Correct! Well done, you have a firm understanding of the Jevons Paradox. Fun fact: The phenomenon is named after William Stanley Jevons, an English economist who first described it in the 19th century",
              "Wrong! Sorry, there is no such thing as a Jevons fruit. You'll have to find your sustenance elsewhere",
              "Sorry, that's not quite right. The Jevons Paradox actually states that increased efficiency can lead to increased consumption, not decreased desire for a resource. But hey, at least you're thinking paradoxically!",
            ],
            question: "What is the Jevons Paradox",
            text: "The Jevons Paradox is a phenomenon that occurs when we use more of a resource, even when we are using it more efficiently. This happens because increased efficiency often leads to lower costs, which can increase demand for the resource.\n\nOne example of this is the use of coal as an energy source. In the late 1700s, people thought that coal deposits were running out, but James Watt's steam engine made it possible to use coal more efficiently. This led to an increase in the demand for coal, even though it was being used more efficiently. The relationship between energy and money is also important to consider.\n\nSome people have proposed using energy as a measure of value for money, but this has not been successful in practice. Bitcoin, on the other hand, uses a system called proof of work, which incentivizes people to use energy efficiently in order to earn rewards.\n\nWhile some people criticize the use of energy in this way, it is important to remember that humans are constantly finding new ways to generate energy, and we should not assume that energy is a fixed or limited resource.\n",
            title: "Jevons Paradox",
          },
          powerLaws: {
            answers: [
              "A power law in economics",
              "A type of pasta dish",
              "A way to fold laundry",
            ],
            feedback: [
              "Good job! The Pareto principle, also known as the 80/20 rule, is a power law that explains how a small amount of something (like 20% of producers) can have a big impact (like 80% of the market share).",
              "Sorry, but it looks like you need to brush up on your economics and not your culinary skills. The Pareto principle is not a type of pasta, although it might be a tasty way to remember it",
              "I'm afraid you're going to have to put away the laundry and pay a little more attention to economics. The Pareto principle is not a way to fold clothes, but it is a useful way to understand how small changes in one thing can lead to bigger changes in another.",
            ],
            question:
              "What is the Pareto principle, also known as the 80/20 rule, an example of",
            text: "Power laws are a way to understand how two things are related. When one thing changes, the other thing changes in a way that is related to the first change. Power laws can show up in different areas, like language, biology, and space. Small changes in one thing can often lead to bigger changes in the other thing.\n\nIn economics, power laws are often shown in graphs. One example of a power law is the Pareto principle, which says that about 80% of the results come from 20% of the things that cause them. In a market, this might mean that 20% of the producers make up 80% of the market.\n\nPower laws can also be seen in other parts of bitcoin, like how much power mining pools have or how many hardware wallets different companies sell. They can also be seen in how bitcoin is distributed among different addresses.\n",
            title: "Power Laws",
          },
          winnerTakeAll: {
            answers: [
              "Because it is the most liquid and the best way to store value",
              "Because it tastes the best",
              "Because it has the prettiest color",
            ],
            feedback: [
              "You got it right. The main reason that people usually agree on using one type of money in a certain area is because it is the most liquid and the best way to store value",
              "I'm afraid you might be confusing money with your favorite flavor of ice cream. Try again",
              "Sorry, but the color of money is not the most important factor in determining which type to use. Better luck next time!",
            ],
            question:
              "What is the main reason that people usually agree on using one type of money in a certain area",
            text: "The concept of winner-take-all effects is when only one product or service is the best and everyone wants to use it. This can happen in markets where a small advantage can lead to getting all of the business.\n\nMoney is a network like this, where only one type of money is used in a certain area because it is the most useful and has the most options for trading with other people. This happens because people want to use the money that will give them the most options and be the most useful in a lot of different situations.\n\nMoney is also a good way to store value over a long time. When it comes to monetary systems, people usually agree on using one type of money because it is the most liquid, or easiest to use, and it is the best way to store value.\n",
            title: "Winner-Take-All Effects",
          },
        },
      },
      BitcoinAndEconomicsIII: {
        title: "Bitcoin and Economics III",
        questions: {
          unitBias: {
            answers: [
              "The belief that one unit of something is always the right amount to use when comparing it to other things",
              "The belief that one type of currency is better than all others",
              "The belief that all units of something should be the same size",
            ],
            feedback: [
              "Yep! Unit bias is the belief that one unit of something is always the right amount to use when comparing it to other things. However, this is not always true and can lead to faulty reasoning. Good job",
              "I'm afraid you're mistaken. Unit bias is not about believing that one type of currency is better than all others. Maybe you should stick to counting your coins instead of trying to determine the value of currency",
              "Sorry, but unit bias is not about the size of units. Don't worry, though – you can still have fun with different sizes of units by playing with building blocks or LEGO bricks.",
            ],
            question: "What is unit bias",
            text: "Unit bias is a type of thinking that assumes that one unit of something is the right amount to use when comparing it to other things.\n\nThis is not always true, especially when it comes to bitcoin. To understand how bitcoin compares to other stores of value, you need to look at the total amount of bitcoin that is available and its value, not just the price of one unit. Bitcoin is very small and can be divided into very small amounts, down to 8 decimal places. This means that you can buy a very small part of a bitcoin if you want.\n\nPeople sometimes think that other cryptocurrencies are cheaper than bitcoin because they cost less per unit, but this is not always true. Bitcoin is a special type of digital money because it is limited in supply and cannot be made in larger amounts.\n\nThis makes it a good way to store value because the value does not decrease over time. When you look at bitcoin in this way, you can see that it is just a small part of the total amount of non-government wealth in the world.\n",
            title: "Unit Bias",
          },
          veblenGood: {
            answers: [
              "A type of good that people want more of when the price goes up",
              "A type of food that tastes better when it is expensive",
              "A type of good that people want more of when they have more money to spend",
            ],
            feedback: [
              "Exactly! A Veblen good is a type of good that people want more of when the price goes up. This is unusual because most people want things more when they have more money to spend",
              "I'm sorry, but a Veblen good is not a type of food. Maybe you should stick to eating your favorite foods instead of trying to understand economics",
              "I'm afraid you're mistaken. A Veblen good is not a type of good that people want more of when they have more money to spend. Maybe you should pay more attention to economics instead of just spending your money!",
            ],
            question: "What is a Veblen good",
            text: "Veblen goods are things that people want more of when the price goes up. Normal goods are things that people usually want more of when they have more money to spend.\n\nVeblen goods are unusual because people want them more when they cost more. These are often luxury goods that are hard to get or that are made in limited quantities. This is done to make them seem special or rare.\n\nSome people might want to buy bitcoin because it is a status symbol, but the main reason people will probably want to buy it is because there is a limited amount of it.\n\nWhen more people want to buy bitcoin, the price goes up and it becomes easier to use. When it is easy to use, more people want to use it. This creates a cycle where the demand for bitcoin increases, the price goes up, and it becomes easier to use.\n",
            title: "Veblen Good",
          },
          malinvestment: {
            answers: [
              "Distorted price signals",
              "Aliens from outer space",
              "A lack of unicorns in the economy",
            ],
            feedback: [
              "Correct answer! You're on the right track. When prices are not accurate, it can lead to money being put into things that are not very productive. Good job",
              "Wrong answer! But at least you're thinking outside the box. Maybe the aliens are controlling the price signals from their spaceship... or maybe not. Better luck next time",
              "Sorry, but unicorns do not have the power to control the economy. Although, it would be pretty cool if they did. Better luck next time.",
            ],
            question: "What is the main cause of malinvestment",
            text: "Malinvestment is when the prices of things are not accurate, which leads to money being put into things that are not very productive. This happens because it is hard to predict the future and make good choices about what to do with money.\n\nWhen the market is not working correctly, it is like trying to use a compass when you are not sure where you are. An example of this is when companies can't pay back their loans and have to borrow more money just to stay alive. This is like being a \"zombie\" company.\n\nWhen the government is in charge of these decisions, they might make mistakes because they don't have a good way to tell what is a good investment and what is not. This can lead to things like building a subway without enough trains or building a dam without enough power lines.\n",
            title: "Malinvestment",
          },
          asymmetricPayoff: {
            answers: [
              "When the potential upside is disproportionately greater than the downside risk",
              "When the potential upside and downside are equal",
              "When the potential upside is a talking llama and the downside is a mute giraffe",
            ],
            feedback: [
              "Correct answer! You got it! An asymmetric payoff means that the potential for gain is much greater than the potential for loss. Good job",
              "Wrong answer! An asymmetric payoff means that the potential for gain or loss is uneven, not equal. Better luck next time",
              "Wrong answer! While a talking llama and mute giraffe might make for an interesting investment, they do not define an asymmetric payoff. Better luck next time.",
            ],
            question:
              "What is an asymmetric payoff in the context of investment decisions",
            text: "When we make decisions about investing our money, we try to predict what might happen and how much money we could make or lose. Sometimes, the amount of money we can make or lose is not equal.\n\nFor example, if we invest in something that has a big chance of making us a lot of money, but only a small chance of losing a little bit of money, we might call this an \"asymmetric payoff.\" This means that the potential upside (how much we can make) is much bigger than the potential downside (how much we can lose).\n\nOne example of this is bitcoin. Bitcoin's potential outcomes are similar to an option, meaning it either succeeds or fails. If it experiences a catastrophic event, the risk of losing money is minimized.\n\nHowever, the potential upside is much greater, as bitcoin's total addressable market has the potential to be a primary global store of wealth.\n\nAsymmetry in payoffs, or uneven potential outcomes, only occurs when there is uneven understanding or information about an investment. If everyone fully understood bitcoin, it would already be widely used as a form of currency.\n\nCurrently, not everyone is aware of bitcoin's potential as a superior monetary option, so the potential for it to increase in value depends on the demand for it increasing without a corresponding increase in the supply.\n",
            title: "Asymmetric Payoff",
          },
          ansoffMatrix: {
            answers: [
              "It helps identify potential growth strategies for the bitcoin protocol",
              "It helps determine the optimal temperature for storing bitcoin",
              "It helps calculate the potential return on investment for bitcoin mining operations",
            ],
            feedback: [
              "Correct answer! You got it! The Ansoff Matrix can be used to outline growth strategies for the bitcoin protocol, such as developing and selling it to different markets. Good job",
              "Nope! Storage temperature for bitcoin private keys is not a real issue, and it is not related to the Ansoff Matrix. Better luck next time",
              "Wrong answer! While calculating potential returns on investment is important for bitcoin miners, it is not directly related to the Ansoff Matrix. Better luck next time.",
            ],
            question:
              "How is the Ansoff Matrix relevant to the growth and potential of bitcoin",
            text: "The Ansoff Matrix is a tool that helps companies think about how they can grow and make more money. It helps them figure out what to do with a product or service they have, and how to sell it to different groups of people.\n\nIn the case of bitcoin, it is a product that is like a type of digital money. It has the potential to be used by a lot of people in a lot of different ways. The people who work on bitcoin, like the people who write the code and help others understand how to use it, are trying to increase the number of people who use it and make it easier for them to do so.\n\nBitcoin can be used to save money and protect it from being taken away, or it can be used to send and receive small amounts of money quickly, without having to go through a lot of steps. As more people start using bitcoin, it has the potential to grow and become more popular.\n\nIt is also possible for people and companies to use bitcoin as part of their financial plans, to help protect their money from losing value. While the main reason people might use bitcoin now is to protect their wealth, the payment use case has been growing fast since the inception of the Lightning Network and other use cases may emerge.\n",
            title: "Ansoff Matrix",
          },
        },
      },
    },
    finishText: "That's all for now, we'll let you know when there's more to unearth",
    getRewardNow: "Answer quiz",
    keepDigging: "Keep digging!",
    phoneNumberNeeded: "Phone number required",
    quizComplete: "Quiz completed and {formattedNumber | sats} earned",
    reviewQuiz: "Review quiz",
    satAccumulated: "Sats accumulated",
    satsEarned: "{formattedNumber | sats} earned",
    sectionsCompleted: "You've completed",
    title: "Earn",
    unlockQuestion: "To unlock, answer the question:",
    youEarned: "You Earned",
    registerTitle: "Need to upgrade your account",
    registerContent: "Register with your phone number to receive sats",
    oneSectionADay: "One section a day!",
    availableTomorrow: "Come back tomorrow to continue earning sats while learning.\n\nOr, click continue to keep learning without rewards.",
    motivatingBadger: "Dig your way through these lessons and earn as you learn",
    continueNoRewards: "Continue (No Rewards)",
    somethingNotRight: "Something's Not Right...",
    defaultErrorMessage: "{errorMessage: string} Please try again later.\nOr, click to continue to keep learning without rewards.",
    customErrorMessage: "It looks like we've detected some unusual activity on your account. To ensure fair play for everyone, we're unable to offer rewards at this time.\nYou can still continue learning without rewards, or please try again later from a different connection.",
    customMessages: {
      invalidPhoneForQuiz:{
        title: "Telco restricted",
        message: "We're experiencing an attack from users with this telco.\nWe've disabled rewards for this telco until further notice. Apologies!",
      },
      invalidIpMetadata:{
        title: "IP restricted",
        message: "We're experiencing an attack from users with this IP.\nWe've disabled rewards for this IP until further notice. Apologies!",
      },
      claimedTooEarly:{
        title: "Reward wallet empty",
        message: "We'll add funds soon. Sorry!",
      },
      notEnoughBalanceForQuiz:{
        title: "Reward wallet empty",
        message: "We'll add funds soon. Sorry!",
      },
      invalidQuizQuestionId:{
        title: "Reward wallet empty",
        message: "We'll add funds soon. Sorry!",
      },
      oneSectionADay:{
        title: "Continue without rewards?",
        message: "You can only do one section per day while earning sats rewards.",
      },
    },
  },
  GetStartedScreen: {
    logInCreateAccount: "Log in / create account",
    createAccount: "Create new account",
    exploreWallet: "Explore wallet",
    login: "Login",
    logBackInWith: "Log back in with",
    headline: "Wallet powered by Blink",
    startTrialAccount: "Start with a trial account",
    startWithTrialAccount: "Start with trial account",
    registerPhoneAccount: "Register phone account",
    trialAccountCreationFailed: "Trial account creation failed",
    trialAccountCreationFailedMessage:
      "Unfortunately, we were unable to create your trial account. Try again later or create an account with a phone number.",
    trialAccountHasLimits: "Trial account has limits",
    trialAccountLimits: {
      modalTitle: "Upgrade for more benefits",
      noBackup: "No backup option",
      sendingLimit: "Reduced daily sending limit",
      noOnchain: "No receiving bitcoin onchain",
      recoveryOption: "Recover funds by SMS or email",
      dailyLimit: "USD 1,000 daily transaction limit",
      onchainReceive: "Receive bitcoin onchain",
    },
  },
  MapScreen: {
    navToSettingsTitle: "Location permissions",
    navToSettingsText:
      "If you'd like to give Blink location permissions, please navigate to your settings and enable it there",
    payBusiness: "Pay this business",
    openSettings: "Open settings",
    title: "Map",
    error: "Oops. Something went wrong while getting your location",
  },
  HomeScreen: {
    receive: "Receive",
    send: "Send",
    title: "Home",
    scan: "Scan",
    updateAvailable: "An update is available.\nTap to update now",
    useLightning: "We use the Lightning Network.",
    myAccounts: "My Accounts",
    walletCountNotTwo:
      "Wallet count is not 2. Please use the dashboard to see all the wallets and funds of this account",
  },
  PinScreen: {
    attemptsRemaining: "Incorrect PIN. {attemptsRemaining: number} attempts remaining.",
    oneAttemptRemaining: "Incorrect PIN. 1 attempt remaining.",
    setPin: "Set your PIN code",
    setPinFailedMatch: "Pins didn't match - Set your PIN code",
    storePinFailed: "Unable to store your pin.",
    tooManyAttempts: "Too many failed attempts. Logging out.",
    verifyPin: "Verify your PIN code",
  },
  PriceHistoryScreen: {
    oneDay: "1D",
    oneMonth: "1M",
    oneWeek: "1W",
    oneYear: "1Y",
    fiveYears: "5Y",
    satPrice: "Price for 100,000 sats: ",
    last24Hours: "last 24 hours",
    lastWeek: "last week",
    lastMonth: "last month",
    lastYear: "last year",
    lastFiveYears: "last five years",
    buyAndSell: "Buy and sell bitcoin",
  },
  PrimaryScreen: {
    title: "Home",
  },
  ReceiveScreen: {
    nfc: "NFC",
    enterAmountFirst: "Please enter an amount first",
    activateNotifications:
      "Do you want to activate notifications to be notified when the payment has arrived?",
    copyClipboard: "Invoice has been copied in the clipboard",
    copyClipboardBitcoin: "Bitcoin address has been copied in the clipboard",
    copyClipboardPaycode: "Paycode/LNURL has been copied in the clipboard",
    invoicePaid: "This invoice has been paid",
    setNote: "set a note",
    tapQrCodeCopy: "Tap QR Code to Copy",
    title: "Receive Bitcoin",
    usdTitle: "Receive to Dollar account",
    error: "Failed to generate invoice. Please contact support if this problem persists.",
    copyInvoice: "Copy",
    shareInvoice: "Share",
    addAmount: "Request Specific Amount",
    expired: "The invoice has expired",
    expiresIn: "Expires in",
    updateInvoice: "Update Invoice",
    flexibleAmountInvoice: "Flexible Amount Invoice",
    copyAddress: "Copy Address",
    shareAddress: "Share Address",
    generatingInvoice: "Generating Invoice",
    regenerateInvoice: "Regenerate Invoice",
    useABitcoinOnchainAddress: "Use a Bitcoin onchain address",
    useALightningInvoice: "Use a Lightning Invoice",
    setANote: "Set a Note",
    invoiceAmount: "Invoice Amount",
    fees: "{minBankFee: string} sats fees for onchain payment below {minBankFeeThreshold: string} sats",
    regenerateInvoiceButtonTitle: "Regenerate Invoice",
    setUsernameButtonTitle: "Set Username",
    invoiceHasExpired: "Invoice has expired",
    setUsernameToAcceptViaPaycode:
      "Set your username to accept via Paycode QR (LNURL) and Lightning Address",
    singleUse: "Single Use",
    invoiceExpired: "Expired Invoice",
    invoiceValidity: {
      validFor1Day: "Valid for 1 day",
      validForNext: "Valid for next {duration: string}",
      validBefore: "Valid before {time: string}",
      expiresIn: "Expires in {duration: string}",
      expiresNow: "Expires now",
    },
    invoiceHasBeenPaid: "Invoice has been paid",
    btcOnChainAddress: "Bitcoin Onchain Address",
    receiveViaInvoice: "Receive via Lightning",
    receiveViaPaycode: "Receive via Paycode",
    receiveViaOnchain: "Receive via Onchain",
    payCodeOrLNURL: "Paycode / LNURL",
    cantReceiveZeroSats:
      "You can't receive zero sats. Please enter an amount corresponding to 1 or more sats.",
    lightningAddress: "Lightning address",
    lightningInvoice: "Lightning invoice",
    bitcoinOnchain: "Bitcoin onchain",
    depositFee:
      "Deposit fee: {fee: string} SAT for amounts under {threshold: string} SAT or {overFee: string} SAT for deposits over {threshold} SAT",
  },
  RedeemBitcoinScreen: {
    title: "Redeem Bitcoin",
    usdTitle: "Redeem to Dollar account",
    error: "Failed to generate invoice. Please contact support if this problem persists.",
    redeemingError:
      "Failed to redeem Bitcoin. Please contact support if this problem persists.",
    submissionError:
      "Failed to submit withdrawal request. Please contact support if this problem persists.",
    minMaxRange: "Min: {minimumAmount: string}, Max: {maximumAmount: string}",
    redeemBitcoin: "Redeem Bitcoin",
    amountToRedeemFrom: "Amount to redeem from {domain: string}",
    redeemAmountFrom: "Redeem {amountToRedeem: string} from {domain: string}",
  },
  ScanningQRCodeScreen: {
    invalidContent:
      "We found:\n\n{found: string}\n\nThis is not a valid Bitcoin address or Lightning invoice",
    expiredContent: "We found:\n\n{found: string}\n\nThis invoice has expired",
    invalidTitle: "Invalid QR Code",
    openLinkTitle: "Open Link",
    confirmOpenLink: "Are you sure you want to open this link?",
    noQrCode: "We could not find a QR code in the image",
    title: "Scan QR",
    permissionCamera: "We need permission to use your camera",
    noCamera: "No camera found",
    openSettings: "Open Settings",
    unableToOpenSettings: "Unable to open settings",
    invalidContentLnurl: "We found:\n\n{found: string}\n\n is not currently supported",
    imageLibraryPermissionsNotGranted:
      "We don't have permissions to access the image library.  Please check app settings for your platform.",
  },
  SecurityScreen: {
    title: "Security and Privacy",
    biometricDescription: "Unlock with fingerprint or facial recognition.",
    biometricTitle: "Biometric",
    biometryNotAvailable: "Biometric sensor is not available.",
    biometryNotEnrolled:
      "Please register at least one biometric sensor in order to use biometric based authentication.",
    hideBalanceDescription:
      "Hides your balance on the home screen when the app starts, so you don't reveal it to anyone looking at your screen.\n\nYou can still see your balance by tapping on the main amount in the header of your home screen.",
    hideBalanceTitle: "Always hide balance",
    pinDescription:
      "Set a 4-digit numerical PIN to unlock",
    pinTitle: "PIN code",
    setPin: "Set PIN",
  },
  SendBitcoinConfirmationScreen: {
    amountLabel: "Amount:",
    confirmPayment: "Confirm payment",
    confirmPaymentQuestion: "Do you want to confirm this payment?",
    destinationLabel: "To:",
    feeLabel: "Fee",
    memoLabel: "Note:",
    paymentFinal: "Payments are final.",
    stalePrice:
      "Your bitcoin price is old and was last updated {timePeriod} ago. Please restart the app before making a payment.",
    title: "Confirm Payment",
    totalLabel: "Total:",
    totalExceed: "Total exceeds your balance of {balance: string}",
    maxFeeSelected:
      "This is the maximum fee you will be charged for this transaction.  It may end up being less once the payment has been made.",
    feeError: "Unable to calculate fee",
    invoiceAlreadyPaid: "This invoice has already been paid",
    somethingWentWrong: "Something went wrong",
    paymentAlreadyAttempted:
      "Payment already attempted.\n\nIf you want to send this payment again, start from scratch.",
    slideToConfirm: "Slide to Confirm",
    slideConfirming: "Confirming...",
    copiedDestination: "Copied destination to clipboard",
    lightningRecommended: "High fee! We recommend Lightning.",
  },
  SendBitcoinDestinationScreen: {
    usernameNowAddress:
      "{bankName: string} usernames are now {bankName: string} addresses.",
    usernameNowAddressInfo:
      'When you enter a {bankName: string} username, we will add "@{lnDomain: string}" to it (e.g maria@{lnDomain: string}) to make it an address. Your username is now a {bankName: string} address too.\n\nGo to your {bankName: string} address page from your Settings to learn how to use it or to share it to receive payments.',
    enterValidDestination: "Enter a valid destination",
    destinationOptions:
      "You can send to a {bankName: string} address, LN address, LN invoice, or BTC address.",
    expiredInvoice: "This invoice has expired. Please generate a new invoice.",
    wrongNetwork:
      "This invoice is for a different network. Please generate a new invoice.",
    invalidAmount:
      "This contains an invalid amount. Please regenerate with a valid amount.",
    usernameDoesNotExist:
      "{lnAddress: string} doesn't seem to be a {bankName: string} address that exists.",
    usernameDoesNotExistAdvice:
      "Either make sure the spelling is right or ask the recipient for an LN invoice or BTC address instead.",
    selfPaymentError: "{lnAddress: string} is your {bankName: string} address.",
    selfPaymentAdvice:
      "If you want to send money to another account that you own, you can use an invoice, LN or BTC address instead.",
    lnAddressError:
      "We can't reach this Lightning address. If you are sure it exists, you can try again later.",
    lnAddressAdvice:
      "Either make sure the spelling is right or ask the recipient for an invoice or BTC address instead.",
    unknownLightning: "We can't parse this Lightning address. Please try again.",
    unknownOnchain: "We can't parse this Bitcoin address. Please try again.",
    newBankAddressUsername:
      "{lnAddress: string} exists as a {bankName: string} address, but you've never sent money to it.",
    confirmUsernameModal: {
      title: "You've never sent money to this address",
      body1: "Please make sure the recipient gave you a {bankName: string} address,",
      bold2bold: "not a username from another wallet.",
      body3:
        "Otherwise, the money will go to a {bankName: string} Account that has the “{lnAddress: string}” address.\n\nCheck the spelling of the first part of the address as well. e.g. jackie and jack1e are 2 different addresses",
      warning:
        "If the {bankName: string} address is entered incorrectly, {bankName: string} can't undo the transaction.",
      checkBox: "{lnAddress: string} is the right address.",
      confirmButton: "I'm 100% sure",
    },
    clipboardError: "Error getting value from clipboard",
    pastedClipboardSuccess: "Pasted from clipboard",
    invalidPhoneNumber: "Enter a valid mobile number",
    phoneNotAllowed: "This field does not accept phone numbers",
  },
  SendBitcoinScreen: {
    willBeSentToMempoolBy: "Transaction should be submitted to mempool",
    amount: "Amount",
    amountExceed: "Amount exceeds your balance of {balance: string}",
    amountExceedsLimit: "Amount exceeds your remaining daily limit of {limit: string}",
    upgradeAccountToIncreaseLimit: "Upgrade your account to increase your limit",
    amountIsRequired: "Amount is required",
    cost: "Cost",
    destination: "Destination",
    destinationRequired: "Destination required",
    fee: "network fee",
    feeCalculationUnsuccessful: "Calculation unsuccessful ⚠️",
    placeholder: "Invoice or Address",
    invalidUsername: "Invalid username",
    noAmount:
      "This invoice doesn't have an amount, so you need to manually specify how much money you want to send",
    notConfirmed:
      "Payment has been sent\nbut is not confirmed yet\n\nYou can check the status\nof the payment in Transactions",
    note: "Note or label",
    success: "Payment successful",
    suggestionInput: "Enter your suggestion",
    max: "Max",
    maxAmount: "Max Amount",
    title: "Send Bitcoin",
    failedToFetchLnurlInvoice: "Failed to fetch lnurl invoice",
    lnurlInvoiceIncorrectAmount:
      "The lnurl server responded with an invoice with an incorrect amount.",
    confirmFeesModal: {
      title: "High fee alert!",
      content:
        "Your fee is more than 50% bigger than the amount sent. Are you sure you want to proceed?\n\nTo reduce fees, ask the receiver to accept transaction via Lightning",
      confirmButton: "I'm 100% sure",
    },
    copiedDestination: "Copied destination to clipboard",
    pendingPayment:
      "The payment has been sent, but hasn't confirmed yet.\n\nIt's possible the payment will not confirm, in which case the funds will be returned to your account.",
    copySuccessMessage: "Copy success message to clipboard",
    openSuccessUrl: "Open success URL in browser",
    copySecretMessage: "Copy secret message to clipboard",
    copiedSuccessMessage: "Message copied successfully",
    copiedSecretMessage: "Secret message copied successfully",
    pendingDecryptionMessage: "Encrypted message. Waiting for payment confirmation.",
    destinationScreenTitle: "Send to",
    orBySMS: "Or Mobile Number",
    orSaved: "Or Saved",
    feeLabel: "Fee",
    noteLabel: "Note",
    sender: "Sender",
    recipient: "Recipient",
    time: "Time",
    type: "Type",
  },
  SettingsScreen: {
    staticQr: "Printable static QR",
    staticQrCopied: "Your static QR code link has been copied",
    setByOs: "Set by OS",
    apiAcess: "API integration",
    apiDocumentation: "API documentation",
    apiDashboard: "API access and dashboard",
    pos: "Point of Sale",
    posCopied: "Your point of sale link has been copied",
    setYourLightningAddress: "Set your lightning address",
    activated: "Activated",
    addressScreen: "Ways to get paid",
    tapUserName: "Tap to set username",
    notifications: "Notifications",
    title: "Settings",
    darkMode: "Dark Mode",
    setToDark: "Mode: dark.",
    setToLight: "Mode: light.",
    darkDefault: "Mode: dark, (Default).",
    lightDefault: "Mode: light, (Default).",
    csvTransactionsError:
      "Unable to export transactions to csv. Something went wrong. If issue persists please contact support.",
    lnurlNoUsername:
      "To generate an lnurl address you must first set a username.  Do you want to set a username now?",
    copyClipboardLnurl: "Lnurl address has been copied in the clipboard",
    defaultWallet: "Default Account",
    rateUs: "Rate us on {storeName: string}",
    theme: "Theme",
    nfc: "Receive from NFC",
    nfcError: "Error reading NFC tag. Please try again.",
    nfcNotCompatible:
      "The information fetch from the card is not a compatible lnurl-withdraw link.",
    nfcOnlyReceive: "Only receive from NFC is available for now",
    nfcScanNow: "Scan NFC Now",
    nfcNotSupported: "NFC is not supported on this device",
    logInOrCreateAccount: "Log in or create account",
    logOutFromOneAccount: "Log out from this account",
    logoutOneAccountAlertTitle: "Are you sure you want to log out from this account?",
    logoutOneAccountAlertContent: "You will be signed out from the session linked to {identifier: string}.\nMake sure you have access to sign in again in the future.",
    logoutOneAccountConfirm: "I understand. Please log out.",
    receiveCurrency: "Receive currency",
    displayCurrency: "Display currency",
  },
  NotificationSettingsScreen: {
    title: "Notification settings",
    pushNotifications: "Enable all",
    notificationCategories: {
      Circles: {
        title: "Circles",
        description: "Notifications about your circles.",
      },
      Payments: {
        title: "Transaction alerts",
        description: "Notifications related to sending and receiving payments.",
      },
      Marketing: {
        title: "Features and updates",
        description: "Notifications about new features and updates.",
      },
      Price: {
        title: "Price changes",
        description: "Notifications about the price of Bitcoin.",
      },
    },
  },
  AccountScreen: {
    fundsMoreThan5Dollars: "Your account has more than $5",
    itsATrialAccount:
      "Trial accounts have reduced transaction limits and no recovery method. If you lose your phone or uninstall the app, your funds will be unrecoverable.",
    accountBeingDeleted: "Your account is being deleted, please wait...",
    dangerZone: "Danger zone",
    phoneDeletedSuccessfully: "Phone deleted successfully",
    phoneNumber: "Phone Number",
    tapToAddPhoneNumber: "Tap to add phone number",
    loginMethods: "Login methods",
    level: "Level {level: string}",
    switchAccount: "Switch account",
    pleaseWait: "Please Wait.",
    accountLevel: "Account Level",
    upgrade: "Upgrade your account",
    logOutAndDeleteLocalData: "Log out and clear all local data",
    IUnderstand: "I understand. Please log me out.",
    logoutAlertTitle: "Are you sure you want to log out and delete all local data?",
    logoutAlertContentPhone:
      "You will need to re-enter your phone number to log back in.\nyour phone number is {phoneNumber: string} so make sure you have access to it to log back in",
    logoutAlertContentEmail:
      "You will need to re-enter your email to log back in.\nyour email is {email: string} so make sure you have access to it to log back in",
    logoutAlertContentPhoneEmail:
      "You will need to re-enter either your phone number or email to log back in.\nyour phone number is {phoneNumber: string} and your email is {email: string} so make sure you have access to those to log back in",
    usdBalanceWarning: "You have a Dollar account balance of {balance: string}.",
    btcBalanceWarning: "You have a bitcoin balance of {balance: string}.",
    secureYourAccount: "Register to secure your account",
    tapToAdd: "Tap to add",
    tapToAddEmail: "Tap to add email",
    unverifiedEmail: "Email (Unverified)",
    email: "Email",
    emailDeletedSuccessfully: "Email deleted successfully",
    unverifiedEmailAdvice:
      "Unverified emails can't be used to login. You should re-verify your email address.",
    deleteEmailPromptTitle: "Delete email",
    deleteEmailPromptContent:
      "Are you sure you want to delete your email address? you will only be able to log back in with your phone number.",
    deletePhonePromptTitle: "Delete phone",
    deletePhonePromptContent:
      "Are you sure you want to delete your phone number? you will only be able to log in back with your email.",
    addEmailFirst: "Add an email first",
    addPhoneFirst: "Add a phone first",
    phoneNumberAuthentication: "Phone number (for login)",
    emailAuthentication: "Email (for login)",
    removePhone: "Remove phone",
    removeEmail: "Remove email",
    unverified: "Email is unverified",
    unverifiedContent: "Secure your account by verifying your email.",
    confirmEmail: "Confirm email",
    emailUnverified: "Your email is unverified",
    emailUnverifiedContent:
      "Ensure you can log back into your account by verifying your email. Do you want to do the verification now?",
    totp: "Two-factor authentication",
    totpDeactivated: "Two-factor authentication has been deactivated",
    totpDeleteAlertTitle: "Delete two-factor authentication",
    totpDeleteAlertContent:
      "Are you sure you want to delete your two-factor authentication?",
    copiedAccountId: "Copied your account ID to clipboard",
    yourAccountId: "Your Account ID",
    accountId: "Account ID",
    copy: "Copy",
    identityVerification: "Identity Verification",
  },
  ProfileScreen: {
    addAccount: "Add account",
    error: "Unable to fetch profiles at this time",
    fromThisDevice: "from this device?",
    switchAccount: "You switched to another account",
    removedAccount: "You removed account {identifier: string}.",
  },
  TotpRegistrationInitiateScreen: {
    title: "Two-factor authentication",
    secret: "Secret/backup",
    content:
      "Scan this QR code with your authenticator app. Alternatively, you can manually copy/paste the secret.",
  },
  TotpRegistrationValidateScreen: {
    title: "Two-factor authentication",
    enter6digitCode:
      "Enter the 6-digit code from your authenticator app to validate your two-factor authentication.",
    success:
      "Two-factor authentication has been enabled. You will now only be able to log back in with your phone or email AND your two factor authentication.\n\nDevices on this account which are not logged in with 2FA will need to log back in.\n\nOnly level 2 accounts can be recovered by customer support in the event of lost 2FA access.",
  },
  TotpLoginValidateScreen: {
    title: "Two-factor authentication",
    content:
      "Enter the 6-digit code from your authenticator app to log in. This code changes every 30 seconds.",
  },
  CopySecretComponent: {
    button: "Copy secret",
    toastMessage: "Secret copied to clipboard!",
  },
  DefaultWalletScreen: {
    title: "Default receive account",
    info: "Your Bitcoin account is for stacking sats, where the USD value moves with the market. Your Dollar account is powered by Stablesats — it holds Bitcoin that is hedged to stay stable in USD terms. You're always holding Bitcoin, but the dollar value doesn't change.",
  },
  ThemeScreen: {
    title: "Theme",
    info: "Pick your preferred theme for using Blink, or choose to keep it synced with your system settings.",
    system: "System setting",
    light: "Light mode",
    dark: "Dark mode",
    setToDark: "Dark mode",
    setToLight: "Light mode",
  },
  Languages: {
    DEFAULT: "Default (OS)",
  },
  StablesatsModal: {
    header: "Your Dollar account is powered by Stablesats",
    body: "The Dollar account uses Stablesats technology to hold Bitcoin stable to USD price. You're always holding Bitcoin — not actual dollars — but the USD value doesn't fluctuate. You can send and receive Bitcoin as usual, but this is not compatible with the traditional banking system.",
    termsAndConditions: "Read the Terms & Conditions.",
    learnMore: "Learn more about Stablesats",
  },
  SplashScreen: {
    update:
      "Your app is outdated. An update is needed before the app can be used.\n\nThis can be done from the PlayStore for Android and Testflight for iOS",
  },
  TransactionDetailScreen: {
    paid: "Paid to/from",
    received: "You received",
    spent: "You spent",
    sending: "Sending",
    receivingAccount: "Receiving Account",
    sendingAccount: "Sending Account",
    txNotBroadcast:
      "Your transaction is queued. It should appear in the mempool {countdown: string}.",
    momentarily: "momentarily",
  },
  TransactionLimitsScreen: {
    receive: "Receive",
    withdraw: "Withdraw",
    perDay: "per day",
    perWeek: "per week",
    unlimited: "Unlimited",
    remaining: "Remaining",
    stablesatTransfers: "Dollar account transfers",
    internalSend: "Send to {bankName: string} user",
    error: "Unable to fetch limits at this time",
    increaseLimits: "Increase your limits",
  },
  TransactionScreen: {
    noTransaction: "No transaction to show",
    title: "All transactions",
    recentTransactions: "Recent transactions",
    transactionHistoryTitle: "Transaction History",
  },
  TransferScreen: {
    title: "Transfer",
    percentageToConvert: "% to convert",
  },
  UpgradeAccountModal: {
    title: "Upgrade your account",
    backUpFunds: "Back up your funds",
    higherLimits: "Increase your transaction limits",
    receiveOnchain: "Receive bitcoin onchain",
    onlyAPhoneNumber: "Quick and easy phone number verification",
    letsGo: "Let's go!",
    stayInTrialMode: "Stay in trial mode",
    upgradeToLevel: "Upgrade to Level {level: number}",
    notNow: "Not now",
    setUpLevelAccount: "Set up Level {level: number} account",
  },
  SetAddressModal: {
    title: "Set {bankName: string} address",
    mainTitle: "Choose Lightning Address",
    setLightningAddress: "Set Lightning address",
    Errors: {
      tooShort: "Address must be at least 3 characters long",
      tooLong: "Address must be at most 50 characters long",
      invalidCharacter: "Address can only contain letters, numbers, and underscores",
      addressUnavailable: "Sorry, this address is already taken",
      unknownError: "An unknown error occurred, please try again later",
    },
    receiveMoney:
      "Receive money from other lightning wallets and {bankName: string} users with this address.",
    itCannotBeChanged: "Choose well – it cannot be changed later!",
  },
  WelcomeFirstScreen: {
    bank: "Bitcoin is designed to let you store, send and receive money, without relying on a bank or credit card.",
    before:
      "Before Bitcoin, people had to rely on banks or credit card providers, to spend, send and receive money.",
    care: "Why should I care?",
    learn: "I don't mean to badger you, but there's lot more to learn, dig in...",
    learnToEarn: "Learn to Earn",
  },
  PhoneLoginInitiateScreen: {
    title: "Account set up",
    header: "Enter your phone number, and we'll text you an access code.",
    headerVerify: "Verify you are human",
    errorRequestingCaptcha:
      "Something went wrong verifying you are human, please try again later.",
    errorRequestingCode:
      "Something went wrong requesting the phone code, please try again later.",
    errorInvalidPhoneNumber:
      "Invalid phone number. Are you sure you entered the right number?",
    errorUnsupportedCountry: "We are unable to support customers in your country.",
    infoArgentina:
      "Argentinian phone numbers require adding a 9 to the beginning of the number.",
    placeholder: "Phone Number",
    verify: "Click to Verify",
    sms: "Send via SMS",
    whatsapp: "Send via WhatsApp",
    telegram: "Send via Telegram",
  },
  LoginMethodScreen: {
    title: "Select preferred login method.",
    useTelegram: "Use Telegram",
    useSms: "Use SMS",
    useWhatsapp: "Use WhatsApp",
    useEmail: "Use Email",
    setupTelegram: "Set up Telegram login",
    setupSms: "Set up SMS login",
    setupWhatsapp: "Set up WhatsApp login",
    setupEmail: "Set up Email login",
  },
  OnboardingScreen: {
    welcomeLevel1: {
      mainTitle: "Welcome to Level 1",
      title: "New features unlocked for your account:",
      receiveBitcoinDescription: "Receive Bitcoin using your phone number",
      dailyLimitDescription: "Send up to USD 1,000 per day",
      onchainDescription: "Receive on-chain payments",
    },
    emailBenefits: {
      mainTitle: "Add email login",
      title: "Email login allows you to:",
      backupDescription: "Have a backup to accessing your account",
      supportDescription: "Make it easier for us to give you support",
      securityDescription: "Increase account security",
      primaryButton: "Set up email login",
    },
    lightningBenefits: {
      mainTitle: "Set up Custom Lightning Address",
      title: "Lightning Address benefits:",
      staticAddressDescription: "A static address to receive payments",
      easyToShareDescription: "Easy to memorize and share publicly or privately",
      blinkToolsDescription: "Unlocks various Blink tools useful for commerce",
      primaryButton: "Set up Custom Address",
    },
    supportScreen: {
      mainTitle: "We love feedback",
      title: "All set!",
      description: "Any feedback is most welcome, feel free to ping us at {email}",
      primaryButton: "Done",
    }
  },
  PhoneLoginValidationScreen: {
    errorLoggingIn: "Error logging in. Did you use the right code?",
    errorTooManyAttempts: "Too many attempts. Please try again later.",
    errorIpNotAllowed:
      "This IP is from an unsupported country and accounts may not be created from it. If you are in a supported country but using a VPN, try deactivating it.",
    errorPhoneNotAllowed: "Accounts may not be created from this phone number.",
    errorCannotUpgradeToExistingAccount:
      "This phone account already exists. Please log out of your trial account and then log in with your phone number.",
    header:
      "To confirm your phone number, enter the code we just sent you by {channel: string} on {phoneNumber: string}",
    placeholder: "6 Digit Code",
    sendAgain: "Send Again",
    tryAgain: "Try Again",
    sendViaOtherChannel:
      "You selected to receive the code via {channel: string}. You can try receiving via {other: string} instead",
  },
  TelegramValidationScreen: {
    text: "Telegram Passport",
    description: "After authorizing in Telegram, you will be automatically logged in",
    loginWithTelegram: "Log in with Telegram",
    waitingForAuthorization: "Waiting for authorization in Telegram...",
    errorFetchParams: "Failed to fetch Telegram auth params",
    errorFetchLogin: "Failed to fetch Telegram login",
    errorAuthTimeout: "Authorization timed out. Please try again.",
    errorOpenAppError: "Failed to open Telegram. Please make sure the app is installed.",
  },
  PhoneRegistrationInitiateScreen: {
    title: "Phone set up",
    header: "Enter your phone number, and we'll text you an access code.",
    headerVerify: "Verify you are human",
    errorRequestingCode:
      "Something went wrong requesting the phone code, please try again later.",
    errorInvalidPhoneNumber:
      "Invalid phone number. Are you sure you entered the right number?",
    errorUnsupportedCountry: "We are unable to support customers in your country.",
    placeholder: "Phone Number",
    verify: "Click to Verify",
    sms: "Send via SMS",
    whatsapp: "Send via WhatsApp",
  },
  PhoneRegistrationValidateScreen: {
    successTitle: "Phone number confirmed",
  },
  EmailRegistrationInitiateScreen: {
    title: "Add your email",
    header: "Enter your email address, and we'll send you an access code.",
    invalidEmail: "Invalid email address. Are you sure you entered the right email?",
    send: "Send code",
    missingEmailRegistrationId: "Missing email registration id",
    placeholder: "hal@finney.org",
  },
  EmailRegistrationValidateScreen: {
    header:
      "To confirm your email address, enter the code we just sent you on {email: string}",
    success: "Email {email: string} confirmed successfully",
  },
  EmailLoginInitiateScreen: {
    title: "Login via email",
    header: "Enter your email address, and we'll send you an access code.",
    invalidEmail: "Invalid email address. Are you sure you entered the right email?",
    send: "Send code",
  },
  EmailLoginValidateScreen: {
    header:
      "If there is an account attached to {email: string}, you should have received 6 digits code to enter below.\n\nIf you are not receiving anything, it's probably either because this is not the right email, the email is in your spam folder.",
    success: "Email {email: string} confirmed successfully",
  },
  common: {
    enabled: "Enabled",
    switch: "Switch",
    notifications: "Notifications",
    preferences: "Preferences",
    onDeviceSecurity: "Security and privacy",
    securityAndPrivacy: "Security and Privacy",
    advanced: "Advanced",
    community: "Community",
    account: "Account",
    yourAccount: "Your account",
    accounts: "Accounts",
    accountInformation: "Account Information",
    trialAccount: "Trial Account",
    blinkUser: "Blink User",
    blinkToBlink: "Blink to Blink",
    transactionLimits: "Transaction limits",
    activateWallet: "Activate Wallet",
    amountRequired: "Amount is required",
    back: "Back",
    backHome: "Back home",
    bank: "Bank",
    bankAccount: "Cash Account",
    bankAdvice: "{bankName: string} Advice",
    bankInfo: "{bankName: string} Info",
    beta: "beta",
    bitcoin: "Bitcoin",
    bitcoinPrice: "Bitcoin Price",
    btcAccount: "Bitcoin Account",
    cancel: "Cancel",
    close: "Close",
    confirm: "Confirm",
    convert: "Convert",
    codeConfirmation: "Code Confirmation",
    currency: "Currency",
    currencySyncIssue: "Currency issue. Refresh needed",
    csvExport: "Export all transactions",
    date: "Date",
    description: "Description",
    domain: "Domain",
    email: "Email",
    error: "Error",
    fatal: "Fatal",
    fee: "fee",
    Fee: "Fee",
    fees: "Fees",
    firstName: "First Name",
    from: "From",
    hour: "hour",
    hours: "hours",
    invoice: "Invoice",
    intraledger: "Intraledger",
    language: "Language",
    languagePreference: "Language preference",
    lastName: "Last Name",
    later: "Later",
    loggedOut: "You have been logged out.",
    logout: "Log Out",
    lightning: "Lightning",
    minutes: "minutes",
    errorAuthToken: "Missing auth token",
    needWallet: "Log in or create an account to access your wallet",
    next: "Next",
    No: "No",
    note: "Note",
    notification: "Notification",
    ok: "OK",
    or: "or",
    openWallet: "Open Wallet",
    onchain: "Onchain",
    paymentRequest: "Payment Request",
    phone: "Phone",
    phoneNumber: "Phone Number",
    preimageProofOfPayment: "Preimage / Proof of Payment",
    rate: "Rate",
    reauth: "Your session has expired. Please log in again.",
    restart: "Restart",
    save: "Save",
    sats: "sats",
    search: "Search",
    security: "Security",
    send: "Send",
    setAnAmount: "set an amount",
    share: "Share",
    shareBitcoin: "Share Bitcoin Address",
    shareLightning: "Share Lightning Invoice",
    soon: "Coming soon!",
    submit: "Submit",
    success: "Success!",
    dollarStablesats: "Dollar (Stablesats)",
    to: "To",
    total: "Total",
    transactions: "Transactions",
    transactionsError: "Error loading transactions",
    tryAgain: "Try Again",
    type: "Type",
    usdAccount: "Dollar Account",
    username: "Username",
    usernameRequired: "Username is required",
    backupAccount: "Backup/upgrade account",
    viewTransaction: "View transaction",
    yes: "Yes",
    pending: "pending",
    today: "Today",
    yesterday: "Yesterday",
    thisMonth: "This month",
    prevMonths: "Previous months",
    problemMaybeReauth:
      "There was a problem with your request. Please retry in one minute. If the problem persist, we recommend that you log out and log back in. You can log out by going into Settings > Account > Log out",
    warning: "Warning",
    continue: "Continue",
    correct: "Correct",
    recommended: "Recommended",
    expirationTime: "Expiration Time",
    minute: "Minute",
    day: {
      one: "Day",
      other: "Days"
    },
    dollar: "Dollar",
    all: "ALL",
    allAccounts: "All accounts",
    some: "Some",
    support: "Support",
    profiles: "Profiles",
    paste: "Paste",
    copied: "Copied to clipboard",
    hasBeenCopiedToClipboard: "{type: string} has been copied to clipboard",
  },
  errors: {
    generic: "There was an error.\nPlease try again later.",
    invalidEmail: "Invalid email",
    invalidPhoneNumber: "is not a valid phone number",
    tooManyRequestsPhoneCode:
      "Too many requests. Please wait before requesting another text message.",
    network: {
      server: "Server Error. Please try again later",
      request: "Request issue.\nContact support if the problem persists",
      connection: "Connection issue.\nVerify your internet connection",
    },
    unexpectedError: "Unexpected error occurred",
    restartApp: "Please restart the application.",
    problemPersists: "If problem persists contact support.",
    fatalError:
      "Sorry we appear to be having issues loading the application data.  If problems persist please contact support.",
    showError: "Show Error",
    clearAppData: "Clear App Data and Logout",
  },
  notifications: {
    payment: {
      body: "You just received {value: string} sats",
      title: "Payment received",
    },
  },
  support: {
    contactUs: "Need help? Contact us.",
    joinTheCommunity: "Join the community",
    whatsapp: "WhatsApp",
    email: "Email",
    sms: "SMS",
    faq: "FAQ",
    enjoyingApp: "Enjoying the app?",
    statusPage: "Status page",
    telegram: "Telegram",
    mattermost: "Mattermost",
    thankYouText: "Thank you for the feedback, would you like to suggest an improvement?",
    defaultEmailSubject: "{bankName: string} - Support",
    defaultSupportMessage:
      "Hey there! I need some help with {bankName: string}, I'm using the version {version: string} on {os: string}.",
    emailCopied: "email {email: string} copied to clipboard",
    deleteAccount: "Delete account",
    delete: "delete",
    typeDelete: 'Please type "{delete: string}" to confirm account deletion',
    finalConfirmationAccountDeletionTitle: "Final Confirmation Required",
    finalConfirmationAccountDeletionMessage:
      "Are you sure you want to delete your account? This action is irreversible.",
    deleteAccountBalanceWarning:
      "Deleting your account will cause you to lose access to your current balance. Are you sure you want to proceed?",
    deleteAccountConfirmation:
      "Your account has been written for deletion.\n\nWhen the probation period related to regulatory requirement is over, the remaining data related to your account will be permanently deleted.",
    deleteAccountFromPhone:
      "Hey there!, please delete my account. My phone number is {phoneNumber: string}.",
    deleteAccountError:
      "Something went wrong. Contact {email: string} for further assistance.",
    bye: "Bye!",
    deleteAccountWarning: "Attention: Account deletion is permanent!\nMake sure wallets have no funds before deleting.\nDeleted account cannot be reinstated.",
  },
  lnurl: {
    overLimit: "You can't send more than max amount",
    underLimit: "You can't send less than min amount",
    commentRequired: "Comment required",
    viewPrintable: "View Printable Version",
  },
  DisplayCurrencyScreen: {
    errorLoading: "Error loading list of currencies",
  },
  AmountInputScreen: {
    enterAmount: "Enter Amount",
    setAmount: "Set Amount",
    maxAmountExceeded: "Amount must not exceed {maxAmount: string}.",
    exceedsAvailableBalance: "Exceeds available balance: {maxAmount: string}",
    minAmountNotMet: "Amount must be at least {minAmount: string}.",
  },
  AmountInputButton: {
    tapToSetAmount: "Set amount",
  },
  AppUpdate: {
    needToUpdateSupportMessage:
      "I need to update my app to the latest version. I'm using the {os: string} app with version {version: string}.",
    versionNotSupported: "This mobile version is no longer supported",
    updateMandatory: "Update is mandatory",
    tapHereUpdate: "Tap here to update now",
    contactSupport: "Contact Support",
  },
  Circles: {
    title: "My Circles",
    titleBlinkCircles: "Blink Circles",
    fetchingLatestCircles: "Fetching latest circles",
    circles: "circles",
    circlesExplainer:
      "Welcome someone to Blink by sending them their first sats! Your circles will grow with each welcome.",
    viewMyCircles: "View My Circles",
    introducingCircles: "Introducing Circles",
    copiedInviteLink: "Copied Invite Link",
    inviteFriendToBlink: "Invite a friend to Blink",
    shareCircles: "Share your circles",
    share: "Share",
    circlesGrowingSatsExplainer: {
      your: "Your",
      grow: "grow when you send a new Blink user their first sats!",
    },
    circlesGrowingKeepGoing:
      "Your circles grow as you welcome people to Blink – keep going!",
    points: "points",
    innerCircleGrow:
      "Your inner circle grows when you send a Blink user their first sats!",
    calculatingYourCircles: "Calculating your circles...",
    innerCircleExplainer: "You're driving Bitcoin adoption with Blink, keep it up!",
    innerCircleExplainerCard: "I'm driving Bitcoin adoption with Blink!",
    innerCircle: "Inner Circle",
    peopleYouWelcomed: "people welcomed by you",
    peopleIWelcomed: "people \nI welcomed",
    thisMonth: "this month",
    outerCircle: "Outer Circle",
    peopleWelcomedByYourCircle: "people welcomed by your circle",
    peopleWelcomedByMyCircle: "people welcomed by my circle",
    yourSphere: "Your Sphere",
    mySphere: "My Sphere",
    yourRankMessage:
      "You're #{thisMonthRank: number} this month and #{allTimeRank: number} all time!",
    rankMessage:
      "#{thisMonthRank: number} this month and #{allTimeRank: number} all time!",
    inviteFriends: "Invite a friend",
    buildYourCircle: "Build your circles",
    myBlinkCircles: "My Blink Circles",
    someones: "{username: string}'s",
    groupEffort:
      "Bitcoin adoption is a group effort.\nInvite a friend and send them sats to start building your circles.",
    drivingAdoption: "I'm driving Bitcoin adoption using Blink.",
    connectOnSocial: "Connect on social: ",
    fullDetails: "Full details at ",
    learnMore: "Learn more about Adopting Bitcoin at",
    mayChallenge: {
      title: "May Challenge!",
      description:
        "Grow your inner circle by 6 for a chance to win a set of Pizzas on your next Bitcoin Meetup.",
      details:
        "Want a Bitcoin Pizza Day Party?\n\nExpand your Inner Circle by 6 for a shot at winning a set of pizzas for your next Bitcoin Meetup. The challenge wraps up on May 15th.\n\nShare your circles on social with the hashtag #blinkcircles to participate.\n\nThe prize is $150 for pizzas.",
    },
    juneChallenge: {
      title: "June Challenge!",
      description:
        "Expand your Inner Circle by 10 for a chance to win a $1000 privilege ticket to the Adopting Bitcoin El Salvador",
      details:
        "Win a privilege ticket to Adopting Bitcoin El Salvador\n\nExpand your Inner Circle by 10 for a chance to win a $1000 privilege ticket to Adopting Bitcoin El Salvador! The ticket includes exclusive access to the main conference, mezzanine with food/drinks/snacks, speakers' dinner, and the Film Festival.\n\nShare your circles on social with the hashtag #blinkcircles to participate.\n\nThis time, there will be two winners!",
    },
  },
  FullOnboarding: {
    title: "Full onboarding",
    confirmNameTitle: "Name confirmation",
    firstName: "First name",
    lastName: "Last name",
    confirmNameContent:
      "Is the spelling of your name correct?\n\n{firstName: string} {lastName: string}\n\nIt must match the name on your ID.",
    requirements:
      "Upgrading your account will increase your limits and give you additional functionality such as transfer to bank accounts in selected countries.\n\nYou will have to provide your name, a governement issued ID and a selfie. We'll start with your name.",
    success:
      "Documents has been successfully received and will be processed shortly. you can come back to this page to have an update on the status of your onboarding",
    error:
      "There has been an error with the submission of your documents. You can contact the support if the problem persists.",
    status: "Your onboarding status is: ",
    ABANDONED: "Abandoned",
    APPROVED: "Approved",
    DECLINED: "Declined",
    ERROR: "Error",
    PROCESSING: "Processing",
    REVIEW: "Review",
  },
  CardFlow: {
    validThruLabel: "VALID THRU",
    cardFrozenTitle: "Card frozen",
    cardFrozenSubtitle: "Card is temporarily disabled",
    TransactionStatus: {
      pending: "Pending",
      completed: "Completed",
    },
    CardDashboard: {
      Actions: {
        details: "Details",
        freeze: "Freeze",
        setLimits: "Set limits",
        statements: "Statements",
      },
      title: "Visa card",
      addFunds: "Add funds",
      transactionsTitle: "Transactions",
      emptyTransactions: "No transactions yet",
    },
    CardDetails: {
      title: "Card details",
      cardNumber: "Card number",
      expiryDate: "Expiry date",
      cvv: "CVV",
      cardholderName: "Cardholder name",
      cardInformation: "Card information",
      cardType: "Card type",
      status: "Status",
      statusActive: "Active",
      statusFrozen: "Frozen",
      statusInactive: "Inactive",
      issued: "Issued",
      network: "Network",
      keepDetailsSafe: "Keep your details safe",
      securityWarning:
        "Never share your card details with anyone. Blink will never ask for your card information via email or phone.",
    },
    CardLimits: {
      title: "Card limits",
      currentLimitsTitle: "Current limits",
      dailySpending: "Daily spending",
      monthlySpending: "Monthly spending",
      spendingLimitsTitle: "Spending limits",
      dailyLimit: "Daily limit",
      dailyLimitHelper: "Maximum amount you can spend per day",
      monthlyLimit: "Monthly spending limits",
      monthlyLimitHelper: "Maximum amount you can spend per month",
      atmLimitsTitle: "ATM withdrawal limits",
      dailyAtmLimit: "Daily ATM limits",
      dailyAtmLimitHelper: "Maximum ATM withdrawal per day",
      monthlyAtmLimit: "Monthly ATM limit",
      monthlyAtmLimitHelper: "Maximum ATM withdrawal per month",
      transactionTypesTitle: "Transaction types",
      TransactionTypes: {
        ecommerce: "Online purchases",
        ecommerceDescription: "Allow online and e-commerce transactions",
        atm: "ATM withdrawals",
        atmDescription: "Allow cash withdrawals from ATMs",
        contactless: "Contactless payments",
        contactlessDescription: "Allow tap-to-pay transactions",
      },
    },
    CardStatements: {
      title: "Statements",
      selectYear: "Select year",
      currentStatement: "Current statement",
      statementPeriod: "Statement period",
      totalSpent: "Total spent",
      monthlyStatements: "Monthly statements",
      downloadAll: "Download all",
      spent: "{amount} spent",
      transactions: "{count} transactions, {amount} spent",
      statementsCount: "{count} statements",
      noStatements: "No statements",
      aboutStatements: "About statements",
      aboutBullet1: "Monthly statements are generated on the last day of each month",
      aboutBullet2: "Statements include all transactions and fees for the period",
      aboutBullet3: "Download statements as PDF",
      notifyNewStatements: "Notify me when new statements are made available",
    },
    CardSettings: {
      title: "Card settings",
      personalDetails: "Personal Details",
      changePin: "Change PIN",
      transactionAlerts: "Transaction alerts",
      transactionAlertsDescription: "Get notified for all transactions",
      securityAlerts: "Security alerts",
      securityAlertsDescription: "Get notified for security-related activities",
      marketingUpdates: "Marketing updates",
      marketingUpdatesDescription: "Product updates and offers",
      cardManagement: "Card management",
      orderPhysicalCard: "Order physical card",
      addToGooglePay: "Add to Google Pay",
      addToAppleWallet: "Add to Apple Wallet",
      replaceCard: "Replace card",
      termsAndConditions: "Card Terms & Conditions",
      privacyPolicy: "Card Privacy Policy",
      closeCardAccount: "Close card account",
      closeCardAccountDescription: "Permanently close your Visa card",
    },
    PersonalDetails: {
      title: "Personal details",
      blinkVisaCardholder: "Blink Visa Cardholder",
      kycVerifiedInformation: "KYC verified information",
      kycVerifiedDescription:
        "Your name, date of birth and address are verified through our KYC process. You can change the information by redoing the KYC process. We don't guarantee an approval.",
      changeKycInformation: "Change KYC information",
      firstName: "First name",
      lastName: "Last name",
      dateOfBirth: "Date of birth",
      contactInformation: "Contact information",
      registeredAddress: "Registered address",
      shippingAddress: "Shipping address",
    },
    AddToMobileWallet: {
      title: "Add to mobile wallet",
      addYourCard: "Add your card",
      addYourCardDescription:
        "Add your Blink Visa card to your mobile wallet for quick and secure payments",
      addTo: "Add to",
      Benefits: {
        title: "Benefits of mobile wallet",
        contactless: "Contactless payments at millions of locations",
        security: "Enhanced security with biometric authentication",
        noPhysicalCard: "No need to carry your physical card",
        worksLocked: "Works even when your phone is locked",
      },
    },
    CardStatus: {
      title: "Visa card",
      CardApproved: {
        title: "Congratulations!",
        subtitle: "Your Blink Visa Card has been activated.",
        buttonLabel: "Order physical card",
      },
      PhysicalCardOrdered: {
        title: "Your physical card is on the way!",
        subtitle: "Order for delivery of your Blink Card has been submitted.",
        buttonLabel: "Create PIN",
      },
    },
    ShippingAddress: {
      title: "Shipping address",
      fullName: "Full name",
      addressLine1: "Address line 1",
      addressLine2: "Address line 2",
      city: "City",
      state: "State",
      postalCode: "Postal code",
      country: "Country",
      important: "Important",
      importantDescription: "Please ensure your address is accurate and complete.",
      noPOBoxes: "Cards cannot be delivered to P.O. boxes",
      signatureRequired: "Signature may be required upon delivery",
      supportedRegions: "Address must be within supported shipping regions",
    },
    TransactionDetails: {
      title: "Transaction details",
      cardInformation: "Card information",
      amount: "Amount",
      time: "Time",
      transactionId: "ID",
      cardUsed: "Card used",
      paymentMethod: "Payment method",
      merchantInformation: "Merchant information",
      merchant: "Merchant",
      category: "Category",
      location: "Location",
      mccCode: "MCC code",
      currencyConversion: "Currency conversion",
      bitcoinRate: "Bitcoin rate",
      bitcoinSpent: "Bitcoin spent",
      conversionFee: "Conversion fee",
      viewOnMap: "View on map",
      downloadReceipt: "Download receipt",
      reportIssue: "Report issue",
      transactionHelp: "Transaction help",
      transactionHelpDescription:
        "If you don't recognize this transaction or need assistance, contact our {supportTeam} immediately.",
      supportTeam: "support team",
      transactionNotFound: "Transaction not found",
    },
    PinScreens: {
      common: {
        confirmNewPin: "Confirm new PIN",
        confirmPinSubtitle: "Please re-enter your new 4-digit PIN to continue.",
        incorrectPin: "Incorrect PIN. Please try again.",
        pinMismatch: "PINs do not match. Re-enter to confirm or go back to change your PIN.",
      },
      CreateFlow: {
        title: "Create PIN",
        steps: {
          setPin: "Set PIN",
          confirm: "Confirm",
        },
        enterYourPin: "Enter your PIN",
        enterPinSubtitle: "Please enter a 4-digit PIN to continue.",
        pinCreatedToast: "PIN has been created successfully",
      },
      ChangeFlow: {
        title: "Change PIN",
        steps: {
          currentPin: "Current PIN",
          newPin: "New PIN",
          confirm: "Confirm",
        },
        enterCurrentPin: "Enter current PIN",
        enterCurrentPinSubtitle: "Please enter your current 4-digit PIN to continue.",
        enterNewPin: "Enter new PIN",
        enterNewPinSubtitle: "Please enter your new 4-digit PIN.",
        pinChangedTitle: "PIN changed",
        pinChangedSubtitle: "Your PIN has been changed successfully.",
        pinChangedToast: "PIN has been changed successfully",
      },
    },
    ReplaceCard: {
      title: "Replace card",
      steps: {
        reportIssue: "Report Issue",
        delivery: "Delivery",
        confirm: "Confirm",
      },
      ReportIssue: {
        title: "Report card Issue",
        subtitle: "Let us know what happened to your card so we can help you get a replacement.",
        cardManagement: "Card management",
        lostCard: "Lost card",
        lostCardDescription: "I misplaced my card and can't find it anywhere.",
        stolenCard: "Stolen card",
        stolenCardDescription: "I misplaced my card and can't find it anywhere.",
        damagedCard: "Damaged card",
        damagedCardDescription: "I misplaced my card and can't find it anywhere.",
        whatHappensNext: "What happens next?",
        bullet1: "Your current card will be frozen for security",
        bullet2: "A new card with different numbers will be issued",
        bullet3: "You can unfreeze if you find your card later",
      },
      Delivery: {
        title: "Delivery options",
        subtitle: "Choose how you'd like to receive your replacement card.",
        standardDelivery: "Standard delivery",
        businessDays: "{day1}-{day2} business days",
        free: "FREE",
        expressDelivery: "Express delivery",
        shippingAddress: "Shipping address",
        useRegisteredAddress: "Use registered address as shipping address",
        chooseDeliverySpeed: "Choose delivery speed",
      },
      Confirm: {
        title: "Confirm replacement",
        subtitle: "Review your request before submitting.",
        requestSummary: "Request summary",
        issueType: "Issue type",
        delivery: "Delivery",
        deliveryTime: "Delivery time",
        shippingCost: "Shipping cost",
        importantInformation: "Important information",
        bullet1: "Your current card will remain active until the new one arrives",
        bullet2: "Your new card will have the same numbers as your current card",
        bullet3: "Destroy your damaged card when the new one arrives",
        submitRequest: "Submit request",
      },
      Status: {
        title: "Your new card is on the way!",
        subtitle: "Order for delivery of your Blink Card has been submitted.",
        buttonLabel: "Dashboard",
      },
    },
    OrderPhysicalCard: {
      title: "Order physical card",
      steps: {
        shipping: "Shipping",
        confirm: "Confirm",
      },
      Shipping: {
        title: "Order your physical card",
        subtitle: "Get your Blink Visa card delivered to your address.",
        registeredAddress: "Registered address",
        useRegisteredAddress: "Use registered address as shipping address",
        delivery: "Delivery",
        standardDelivery: "Standard delivery",
        expressDelivery: "Express delivery",
        businessDays: "{day1}-{day2} business days",
        free: "FREE",
        deliveryInformation: "Delivery information",
        bullet1: "You'll receive tracking information via email",
        bullet2: "Signature may be required upon delivery",
        bullet3: "Card will be shipped in discreet packaging",
        bullet4: "Activate your card when it arrives",
        cardFeatures: "Card features",
        feature1: "Contactless payment technology",
        feature2: "EMV chip for enhanced security",
        feature3: "Magnetic stripe for universal acceptance",
        feature4: "Your name embossed on the card",
        important: "Important",
      },
      Confirm: {
        title: "Confirm your order",
        subtitle: "Review your physical card order before submitting.",
        orderSummary: "Order summary",
        cardDesign: "Card design",
        delivery: "Delivery",
        deliveryTime: "Delivery time",
        shippingCost: "Shipping cost",
        shippingAddress: "Shipping address",
        placeOrder: "Place order",
        important: "Important",
        bullet1: "Your virtual card will remain active while you wait for the physical card",
        bullet2: "You'll need to activate your physical card when it arrives",
        bullet3: "Both cards will have the same card number and details",
      },
    },
  },
  NotificationHistory: {
    title: "Notifications",
    noNotifications: "You don't have any notifications right now",
  },
}

export default en
