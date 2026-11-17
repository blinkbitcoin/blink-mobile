import fs from "fs"
import path from "path"

import { describe, expect, it } from "@jest/globals"

/**
 * The copy for a restrictions query that stopped answering, pinned per locale so a
 * retranslation cannot slip back to English or to "your region". The parity spec only
 * checks that the keys exist. Read from the raw files, like parity does, so the locales
 * that are translated but not compiled are pinned too.
 */
const RAW_I18N_DIR = path.resolve(__dirname, "..", "..", "app", "i18n", "raw-i18n")
const TRANSLATIONS_DIR = path.join(RAW_I18N_DIR, "translations")
const SOURCE_FILE = path.join(RAW_I18N_DIR, "source", "en.json")

type UnknownRegionCopy = {
  locale: string
  walletLabel: string
  modalTitle: string
  modalBody: string
}

type CopySource = {
  StablesatsRestriction: { unknownRegionWalletLabel: string }
  DollarBalanceRestriction: {
    unknownRegionModalTitle: string
    unknownRegionModalBody: string
  }
}

const readCopy = (locale: string): CopySource => {
  const file =
    locale === "en" ? SOURCE_FILE : path.join(TRANSLATIONS_DIR, `${locale}.json`)
  return JSON.parse(fs.readFileSync(file, "utf8")) as CopySource
}

const COPY: readonly UnknownRegionCopy[] = [
  {
    locale: "en",
    walletLabel: "couldn't check availability, pull down to retry",
    modalTitle: "Couldn't check Dollar Balance availability",
    modalBody:
      "We couldn't check whether the Dollar Balance is available to you. Pull down on the home screen to try again.",
  },
  {
    locale: "af",
    walletLabel: "beskikbaarheid kon nie nagegaan word nie, trek af om weer te probeer",
    modalTitle: "Kon nie Dollar-saldo se beskikbaarheid nagaan nie",
    modalBody:
      "Ons kon nie nagaan of die Dollar-saldo vir jou beskikbaar is nie. Trek af op die tuisskerm om weer te probeer.",
  },
  {
    locale: "ar",
    walletLabel: "تعذّر التحقق من التوفر، اسحب للأسفل لإعادة المحاولة",
    modalTitle: "تعذّر التحقق من توفر رصيد الدولار",
    modalBody:
      "لم نتمكن من التحقق مما إذا كان رصيد الدولار متاحًا لك. اسحب للأسفل في الشاشة الرئيسية لإعادة المحاولة.",
  },
  {
    locale: "ca",
    walletLabel:
      "no s'ha pogut comprovar la disponibilitat, llisca avall per tornar-ho a provar",
    modalTitle: "No s'ha pogut comprovar la disponibilitat del saldo en dòlars",
    modalBody:
      "No hem pogut comprovar si el saldo en dòlars està disponible per a tu. Llisca avall a la pantalla d'inici per tornar-ho a provar.",
  },
  {
    locale: "cs",
    walletLabel: "dostupnost se nepodařilo ověřit, potažením dolů to zkuste znovu",
    modalTitle: "Dostupnost dolarového zůstatku se nepodařilo ověřit",
    modalBody:
      "Nepodařilo se nám ověřit, zda je pro vás dolarový zůstatek k dispozici. Potažením dolů na domovské obrazovce to zkuste znovu.",
  },
  {
    locale: "da",
    walletLabel: "tilgængelighed kunne ikke tjekkes, træk ned for at prøve igen",
    modalTitle: "Kunne ikke tjekke Dollar-saldoens tilgængelighed",
    modalBody:
      "Vi kunne ikke tjekke, om Dollar-saldoen er tilgængelig for dig. Træk ned på startskærmen for at prøve igen.",
  },
  {
    locale: "de",
    walletLabel:
      "Verfügbarkeit konnte nicht geprüft werden, zum Wiederholen nach unten ziehen",
    modalTitle: "Verfügbarkeit des Dollar-Guthabens konnte nicht geprüft werden",
    modalBody:
      "Wir konnten nicht prüfen, ob das Dollar-Guthaben für dich verfügbar ist. Ziehe den Startbildschirm nach unten, um es erneut zu versuchen.",
  },
  {
    locale: "el",
    walletLabel:
      "δεν ήταν δυνατός ο έλεγχος διαθεσιμότητας, σύρε προς τα κάτω για επανάληψη",
    modalTitle: "Δεν ήταν δυνατός ο έλεγχος διαθεσιμότητας του υπολοίπου δολαρίων",
    modalBody:
      "Δεν μπορέσαμε να ελέγξουμε αν το υπόλοιπο δολαρίων είναι διαθέσιμο για εσένα. Σύρε προς τα κάτω στην αρχική οθόνη για να δοκιμάσεις ξανά.",
  },
  {
    locale: "es",
    walletLabel:
      "no se pudo comprobar la disponibilidad, desliza hacia abajo para reintentar",
    modalTitle: "No se pudo comprobar la disponibilidad del saldo en dólares",
    modalBody:
      "No pudimos comprobar si el saldo en dólares está disponible para ti. Desliza hacia abajo en la pantalla de inicio para intentarlo de nuevo.",
  },
  {
    locale: "fr",
    walletLabel:
      "impossible de vérifier la disponibilité, tirez vers le bas pour réessayer",
    modalTitle: "Impossible de vérifier la disponibilité du solde en dollars",
    modalBody:
      "Nous n'avons pas pu vérifier si le solde en dollars est disponible pour vous. Tirez vers le bas sur l'écran d'accueil pour réessayer.",
  },
  {
    locale: "hr",
    walletLabel:
      "dostupnost nije bilo moguće provjeriti, povucite prema dolje za ponovni pokušaj",
    modalTitle: "Nije bilo moguće provjeriti dostupnost dolarskog salda",
    modalBody:
      "Nismo mogli provjeriti je li vam dolarski saldo dostupan. Povucite prema dolje na početnom zaslonu za ponovni pokušaj.",
  },
  {
    locale: "hu",
    walletLabel: "az elérhetőséget nem sikerült ellenőrizni, húzd le az újrapróbáláshoz",
    modalTitle: "A dolláregyenleg elérhetőségét nem sikerült ellenőrizni",
    modalBody:
      "Nem tudtuk ellenőrizni, hogy a dolláregyenleg elérhető-e számodra. Húzd le a kezdőképernyőt az újrapróbáláshoz.",
  },
  {
    locale: "hy",
    walletLabel:
      "հասանելիությունը հնարավոր չեղավ ստուգել, քաշեք ներքև՝ կրկին փորձելու համար",
    modalTitle: "Հնարավոր չեղավ ստուգել դոլարային մնացորդի հասանելիությունը",
    modalBody:
      "Մենք չկարողացանք ստուգել՝ արդյոք դոլարային մնացորդը հասանելի է ձեզ։ Քաշեք ներքև գլխավոր էկրանին՝ կրկին փորձելու համար։",
  },
  {
    locale: "id",
    walletLabel: "ketersediaan tidak dapat diperiksa, tarik ke bawah untuk mencoba lagi",
    modalTitle: "Tidak dapat memeriksa ketersediaan saldo dolar",
    modalBody:
      "Kami tidak dapat memeriksa apakah saldo dolar tersedia untuk Anda. Tarik ke bawah di layar beranda untuk mencoba lagi.",
  },
  {
    locale: "it",
    walletLabel:
      "impossibile verificare la disponibilità, trascina verso il basso per riprovare",
    modalTitle: "Impossibile verificare la disponibilità del saldo in dollari",
    modalBody:
      "Non siamo riusciti a verificare se il saldo in dollari è disponibile per te. Trascina verso il basso nella schermata iniziale per riprovare.",
  },
  {
    locale: "ja",
    walletLabel: "利用可否を確認できませんでした。下に引いて再試行してください",
    modalTitle: "ドル残高の利用可否を確認できませんでした",
    modalBody:
      "ドル残高がご利用いただけるかどうかを確認できませんでした。ホーム画面を下に引いて、もう一度お試しください。",
  },
  {
    locale: "lg",
    walletLabel: "tetusobodde kukebera oba kiriwo, sika wansi okuddamu okugezaako",
    modalTitle: "Tetusobodde kukebera oba bbalansi ya doola eriwo",
    modalBody:
      "Tetusobodde kukebera oba bbalansi ya doola eriwo gy'oli. Sika wansi ku sikulini enkulu okuddamu okugezaako.",
  },
  {
    locale: "ms",
    walletLabel: "ketersediaan tidak dapat disemak, tarik ke bawah untuk cuba lagi",
    modalTitle: "Tidak dapat menyemak ketersediaan baki dolar",
    modalBody:
      "Kami tidak dapat menyemak sama ada baki dolar tersedia untuk anda. Tarik ke bawah pada skrin utama untuk cuba lagi.",
  },
  {
    locale: "nl",
    walletLabel:
      "beschikbaarheid kon niet worden gecontroleerd, trek omlaag om opnieuw te proberen",
    modalTitle: "Kon de beschikbaarheid van het Dollar-saldo niet controleren",
    modalBody:
      "We konden niet controleren of het Dollar-saldo voor jou beschikbaar is. Trek het startscherm omlaag om het opnieuw te proberen.",
  },
  {
    locale: "pt",
    walletLabel:
      "não foi possível verificar a disponibilidade, puxe para baixo para tentar novamente",
    modalTitle: "Não foi possível verificar a disponibilidade do saldo em dólares",
    modalBody:
      "Não conseguimos verificar se o saldo em dólares está disponível para você. Puxe para baixo na tela inicial para tentar novamente.",
  },
  {
    locale: "qu",
    walletLabel:
      "manam kasqanta qhawayta atikurqanchu, uraman aysay yapamanta yanaykunaykipaq",
    modalTitle: "Manam dólar saldo kasqanta qhawayta atikurqanchu",
    modalBody:
      "Manam qhawayta atirqanchu dólar saldo qampaq kasqanta. Qallariy pantallapi uraman aysay yapamanta yanaykunaykipaq.",
  },
  {
    locale: "ro",
    walletLabel:
      "disponibilitatea nu a putut fi verificată, trage în jos pentru a reîncerca",
    modalTitle: "Nu s-a putut verifica disponibilitatea soldului în dolari",
    modalBody:
      "Nu am putut verifica dacă soldul în dolari este disponibil pentru tine. Trage în jos pe ecranul principal pentru a reîncerca.",
  },
  {
    locale: "sk",
    walletLabel: "dostupnosť sa nepodarilo overiť, potiahnutím nadol to skúste znova",
    modalTitle: "Dostupnosť dolárového zostatku sa nepodarilo overiť",
    modalBody:
      "Nepodarilo sa nám overiť, či je pre vás dolárový zostatok k dispozícii. Potiahnutím nadol na domovskej obrazovke to skúste znova.",
  },
  {
    locale: "sr",
    walletLabel:
      "доступност није било могуће проверити, превуците надоле да покушате поново",
    modalTitle: "Није било могуће проверити доступност доларског салда",
    modalBody:
      "Нисмо могли да проверимо да ли вам је доларски салдо доступан. Превуците надоле на почетном екрану да покушате поново.",
  },
  {
    locale: "sw",
    walletLabel: "haikuwezekana kukagua upatikanaji, vuta chini ili kujaribu tena",
    modalTitle: "Haikuwezekana kukagua upatikanaji wa salio la dola",
    modalBody:
      "Hatukuweza kukagua kama salio la dola linapatikana kwako. Vuta chini kwenye skrini ya mwanzo ili kujaribu tena.",
  },
  {
    locale: "th",
    walletLabel: "ไม่สามารถตรวจสอบความพร้อมใช้งานได้ ดึงลงเพื่อลองอีกครั้ง",
    modalTitle: "ไม่สามารถตรวจสอบความพร้อมใช้งานของยอดเงินดอลลาร์ได้",
    modalBody:
      "เราไม่สามารถตรวจสอบได้ว่ายอดเงินดอลลาร์พร้อมใช้งานสำหรับคุณหรือไม่ ดึงลงที่หน้าจอหลักเพื่อลองอีกครั้ง",
  },
  {
    locale: "tr",
    walletLabel: "kullanılabilirlik kontrol edilemedi, yeniden denemek için aşağı çekin",
    modalTitle: "Dolar bakiyesinin kullanılabilirliği kontrol edilemedi",
    modalBody:
      "Dolar bakiyesinin sizin için kullanılabilir olup olmadığını kontrol edemedik. Yeniden denemek için ana ekranı aşağı çekin.",
  },
  {
    locale: "vi",
    walletLabel: "không thể kiểm tra tình trạng khả dụng, kéo xuống để thử lại",
    modalTitle: "Không thể kiểm tra tình trạng khả dụng của số dư đô la",
    modalBody:
      "Chúng tôi không thể kiểm tra liệu số dư đô la có khả dụng với bạn hay không. Kéo xuống trên màn hình chính để thử lại.",
  },
  {
    locale: "xh",
    walletLabel: "ukufumaneka akukwazanga kujongwa, tsala ezantsi ukuze uzame kwakhona",
    modalTitle: "Akukwazekanga ukujonga ukufumaneka kwebhalansi yedola",
    modalBody:
      "Asikwazanga ukujonga ukuba ibhalansi yedola iyafumaneka na kuwe. Tsala ezantsi kwiskrini sasekhaya ukuze uzame kwakhona.",
  },
]

describe("unknown-region copy", () => {
  it.each(COPY)(
    "reads its own words in $locale",
    ({ locale, walletLabel, modalTitle, modalBody }: UnknownRegionCopy) => {
      const copy = readCopy(locale)

      expect(copy.StablesatsRestriction.unknownRegionWalletLabel).toBe(walletLabel)
      expect(copy.DollarBalanceRestriction.unknownRegionModalTitle).toBe(modalTitle)
      expect(copy.DollarBalanceRestriction.unknownRegionModalBody).toBe(modalBody)
    },
  )

  it("pins every translation file there is", () => {
    const onDisk = fs
      .readdirSync(TRANSLATIONS_DIR)
      .map((file) => path.basename(file, ".json"))
      .sort()
    const pinned = COPY.map((row) => row.locale)
      .filter((locale) => locale !== "en")
      .sort()

    expect(onDisk).toEqual(pinned)
  })

  it("never leaks the English copy into another locale", () => {
    const english = COPY.find((row) => row.locale === "en")
    for (const row of COPY.filter((candidate) => candidate.locale !== "en")) {
      expect(row.walletLabel).not.toBe(english?.walletLabel)
      expect(row.modalTitle).not.toBe(english?.modalTitle)
      expect(row.modalBody).not.toBe(english?.modalBody)
    }
  })
})
