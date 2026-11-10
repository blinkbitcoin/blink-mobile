import { existsSync, readFileSync } from "fs"
import { join } from "path"

import { fonts } from "@app/rne-theme/fonts"

/**
 * A face the theme names but a platform does not ship renders the system font, silently.
 * iOS needs the file referenced by the Xcode project (so it is copied into the bundle) and
 * listed in Info.plist; Android loads it from its assets by file name. The artifacts under
 * test are the project files, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8")

const pbxproj = read("ios/GaloyApp.xcodeproj/project.pbxproj")
const infoPlist = read("ios/GaloyApp/Info.plist")

Object.values(fonts).forEach((face) => {
  const file = `${face}.ttf`

  describe(file, () => {
    it("is in the app's font assets", () => {
      expect(existsSync(join(REPO_ROOT, "app/assets/fonts", file))).toBe(true)
    })

    it("is in the Android font assets", () => {
      expect(existsSync(join(REPO_ROOT, "android/app/src/main/assets/fonts", file))).toBe(
        true,
      )
    })

    it("is listed under UIAppFonts in Info.plist", () => {
      expect(infoPlist).toContain(`<string>${file}</string>`)
    })

    it("is copied into the iOS bundle", () => {
      const fileRef = new RegExp(
        `([0-9A-F]{24}) /\\* ${file} \\*/ = \\{isa = PBXFileReference;[^}]*path = "../app/assets/fonts/${file}"`,
      ).exec(pbxproj)
      expect(fileRef).not.toBeNull()

      const buildFile = new RegExp(
        `([0-9A-F]{24}) /\\* ${file} in Resources \\*/ = \\{isa = PBXBuildFile; fileRef = ${fileRef?.[1]} `,
      ).exec(pbxproj)
      expect(buildFile).not.toBeNull()

      const resourcesPhase =
        /isa = PBXResourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/.exec(pbxproj)
      expect(resourcesPhase?.[1]).toContain(buildFile?.[1])
    })
  })
})
