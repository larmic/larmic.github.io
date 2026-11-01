// Automatisch übernommen aus dem Design-Prototyp. 8×8-Texturen (Blöcke) und Figur-Texturen.
// Jeder Buchstabe einer Zeile ist ein Pixel; die Palette ordnet ihm Farbschichten [Farbe, Deckkraft] zu.
// '$hair', '$skin', '$shirt' werden beim Build durch die Avatar-Farben ersetzt (src/data/avatar.ts).

export type Layer = [string, number];
export type Palette = Record<string, Layer[]>;
export type Grid = string[];

export const ARM_L: Grid = ["TT", "TT", "TT", "TT", "tt", "SS"];
export const ARM_R: Grid = ["TTT", "TTT", "TTT", "TTT", "ttt", "SSS"];
export const ARM_T: Grid = ["TT", "TT", "TT"];
export const BEARD_L: Grid = ["..........", "..........", "..........", "..........", "..........", "B........B", "BB.BBBB.BB", "BBB....BBB", ".BBBBBBBB."];
export const BEARD_R: Grid = [".........", ".........", ".........", ".........", ".........", "...B.....", "BBBBB....", "BBBBBB...", "BBBBBBB.."];
export const BED: Grid = ["BbbBgBbB", "bBgBbbBB", "BBbbBgBb", "gBBbBBbB", "bbBgBbBB", "BgBBbBgb", "BBbBBgBB", "bBgbBBbB"];
export const BLINK_L: Grid = ["..........", "..........", "..........", "..........", "..SS..SS..", "..........", "..........", "..........", ".........."];
export const BOARD_L: Grid = ["aaaaaaaa", "aOOWUUWa", "aOOWUUWa", "aWWWWWWa", "aYYWOOWa", "aYYWOOWa", "aWWWWWWa", "aaaaaaaa"];
export const BOARD_R: Grid = ["aaaaaaaa", "aWOOWPPa", "aWOOWPPa", "aWWWWWWa", "aUUWOOWa", "aUUWOOWa", "aWWWWWWa", "aaaaaaaa"];
export const BODY_L: Grid = ["TttttT", "TLTTLT", "TLTTLT", "TTTTTT", "TTTTTT", "TttttT", "tttttt"];
export const BODY_R: Grid = ["TTTT", "TTTT", "TTTT", "TTTT", "TTTT", "TTTT", "tttt"];
export const BODY_T: Grid = ["TTTTTT", "TTTTTT", "TTTTTT", "TTTTTT"];
export const CRACK: Grid = ["........", "...c....", "...cc...", "..c..c..", ".c...cc.", ".....c..", "....c...", "........"];
export const CRATE: Grid = ["dddddddd", "dCCCCCdd", "dCCCCdCd", "dCCCdCCd", "dCCdCCCd", "dCdCCCCd", "ddCCCCCd", "dddddddd"];
export const CRYSTAL: Grid = ["CCCddCCC", "CCdhhdCC", "CdhhhhdC", "dhhhhhhd", "dhhhhhhd", "CdhhhhdC", "CCdhhdCC", "CCCddCCC"];
export const DEEP: Grid = ["DDdDDDDl", "DlDDdDDD", "DDDDDDdD", "dDDlDDDD", "DDDDdDDl", "DdDDDDDD", "DDDlDdDD", "lDDDDDDd"];
export const DIRT: Grid = ["DDdDDDeD", "DeDDdDDD", "DDDDDDdD", "dDDeDDDD", "DDDDdDDe", "DdDDDDDD", "DDDeDdDD", "eDDDDDDd"];
export const GLASS_L: Grid = ["..........", "..........", "..........", ".GGGGGGGG.", ".G..GG..G.", ".GGG..GGG.", "..........", "..........", ".........."];
export const GLASS_R: Grid = [".........", ".........", ".........", "GGGG.....", ".........", ".........", ".........", ".........", "........."];
export const GRASS_SIDE: Grid = ["GlGGGGlG", "GGgGlGGg", "gDGgDGgD", "DDDDdDDD", "DdDeDDDd", "DDDDDDeD", "eDdDDdDD", "DDDDeDDD"];
export const GRASS_TOP: Grid = ["GgGGlGGG", "GGGgGGGl", "lGGGGgGG", "GGgGGGGG", "GGGGlGgG", "GgGGGGGG", "GGGlGGgG", "gGGGGlGG"];
export const HB_BEARD_L: Grid = ["........", "........", "........", "........", "........", "B......B", "BB....BB", "BBBBBBBB"];
export const HB_BEARD_R: Grid = ["........", "........", "........", "........", "........", "........", "BBBB....", "BBBBBB.."];
export const HB_GLASS_L: Grid = ["........", "........", "........", "GGGGGGGG", "G..GG..G", "GGG..GGG", "........", "........"];
export const HB_GLASS_R: Grid = ["........", "........", "........", "GGGG....", "........", "........", "........", "........"];
export const HB_L: Grid = ["HHHHHHHH", "HHHHHHHH", "HHHSSSSH", "HShSShSH", "SWESSEWS", "SSSssSSS", "SSMMMMSS", "SSSSSSSS"];
export const HB_R: Grid = ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SSHHHHHH", "SSSsHHHH", "SSSsHHHH", "SSSSSHHH", "SSSSSSHH"];
export const HB_T: Grid = ["HHHHHHHH", "HhHHHHhH", "HHHHhHHH", "HHhHHHHH", "HHHHHHhH", "HhHHHHHH", "HHHHhHHH", "HHHHHHHH"];
export const HEAD_L: Grid = ["HHHHHHHHHH", "HHHHHHHHHH", "HHHSSSSSSH", "HShhSShhSH", "HSWESSEWSH", "SSSSssSSSS", "SSSSSSSSSS", "SSSMMMMSSS", "SSSSSSSSSS"];
export const HEAD_R: Grid = ["HHHHHHHHH", "HHHHHHHHH", "HHHHHHHHH", "HSSSHHHHH", "HSSSsHHHH", "SSSSsHHHH", "SSSSSHHHH", "SSSSSSHHH", "SSSSSSSHH"];
export const HEAD_T: Grid = ["HHHHHHHHHH", "HHhHHHHHHH", "HHHHHHhHHH", "HHHHHHHHHH", "HhHHHHHHHH", "HHHHHhHHHH", "HHHHHHHHhH", "HHHhHHHHHH", "HHHHHHHHHH"];
export const LEAVES: Grid = ["FfFkFFqF", "kFFfFkFF", "FqFFFfFk", "FFkFqFFF", "fFFFFkFf", "FkFqFFFF", "FFfFFkqF", "qFFkFfFF"];
export const LEGL_L: Grid = ["PPP", "PPP", "PPP", "PPP", "PPP", "KKK"];
export const LEGR_L: Grid = ["pPP", "pPP", "pPP", "pPP", "pPP", "KKK"];
export const LEG_R: Grid = ["PPP", "PPP", "PPP", "PPP", "PPP", "KKK"];
export const LEG_T: Grid = ["PPP", "PPP", "PPP"];
export const LOG_SIDE: Grid = ["BbBBnBbB", "BbBnBBbB", "BBbBBnBb", "nBbBBBbB", "BbBBnBbB", "BbBnBBbB", "BBbBBnBb", "nBbBBBbB"];
export const LOG_TOP: Grid = ["BBBBBBBB", "BwwwwwwB", "BwxxxxwB", "BwxwwxwB", "BwxwwxwB", "BwxxxxwB", "BwwwwwwB", "BBBBBBBB"];
export const METAL: Grid = ["hhhhhhhd", "hdCCCCdd", "hCCCCCCd", "hCCCCCCd", "hCCCCCCd", "hCCCCCCd", "hdCCCCdd", "dddddddd"];
export const ORE: Grid = ["SSsSSSSr", "SXXSSsSS", "SXxSrSSS", "sSSSSXXS", "SSrSSXxS", "SXXsSSrS", "rSXxSSSS", "SSSSsSSs"];
export const PAL_BEARD: Palette = {"B": [["$hair", 1], ["#000", 0.12]]};
export const PAL_BED: Palette = {"B": [["#3a3a42", 1]], "b": [["#1f1f25", 1]], "g": [["#55555f", 1]]};
export const PAL_BLINK: Palette = {"S": [["$skin", 1]]};
export const PAL_BOARD: Palette = {"A": [["#c0915b", 1]], "a": [["#8f6438", 1]], "z": [["#7a522c", 1]], "W": [["#f3efe6", 1]], "O": [["#f39a3d", 1]], "U": [["#5aa6e8", 1]], "Y": [["#f2d14b", 1]], "P": [["#e77fb3", 1]]};
export const PAL_CRACK: Palette = {"c": [["#15161b", 0.85]]};
export const PAL_DEEP: Palette = {"D": [["#4a4d5a", 1]], "d": [["#3c3e4a", 1]], "l": [["#5c5f6d", 1]]};
export const PAL_FIG: Palette = {"H": [["$hair", 1]], "h": [["$hair", 1], ["#000", 0.28]], "S": [["$skin", 1]], "s": [["$skin", 1], ["#000", 0.14]], "W": [["#f6f3ec", 1]], "E": [["#1d2233", 1]], "M": [["#8e4a3a", 1]], "T": [["$shirt", 1]], "t": [["$shirt", 1], ["#000", 0.22]], "L": [["#f6f3ec", 1]], "P": [["#2d3448", 1]], "p": [["#222838", 1]], "K": [["#ece7dc", 1]]};
export const PAL_GLASS: Palette = {"G": [["#1b1d24", 1]]};
export const PAL_GRASS: Palette = {"G": [["#6dbd47", 1]], "g": [["#58a73a", 1]], "l": [["#88d45c", 1]], "D": [["#9b6a43", 1]], "d": [["#7d5232", 1]], "e": [["#b27f53", 1]]};
export const PAL_LEAVES: Palette = {"F": [["#3f9a3c", 1]], "f": [["#2f7e2e", 1]], "k": [["#5ab651", 1]], "q": [["#235f28", 1]]};
export const PAL_LOG: Palette = {"B": [["#7a5432", 1]], "b": [["#5d3e21", 1]], "n": [["#93683f", 1]], "w": [["#c9a066", 1]], "x": [["#a77c46", 1]]};
export const PAL_PSTONE: Palette = {"l": [["#a9aeb7", 1]], "S": [["#8c919b", 1]], "s": [["#6a6f79", 1]]};
export const PAL_SCREEN: Palette = {"m": [["#454b59", 1]], "g": [["#2b303b", 1]], "n": [["#1b2030", 1]], "R": [["#ee4b3e", 1]]};
export const PAL_SHELF: Palette = {"A": [["#c0915b", 1]], "a": [["#8f6438", 1]], "z": [["#6f4a27", 1]], "r": [["#c0453a", 1]], "b": [["#3f6fb5", 1]], "B": [["#2c4f8a", 1]], "g": [["#4f9a4a", 1]], "y": [["#d9a33a", 1]], "v": [["#8a5bb5", 1]], "V": [["#6a4096", 1]]};
export const PAL_STONE: Palette = {"S": [["#8f949b", 1]], "s": [["#747980", 1]], "r": [["#a8adb3", 1]]};
export const PAL_TINT: Palette = {"C": [["currentColor", 1]], "d": [["currentColor", 1], ["#000", 0.32]], "h": [["currentColor", 1], ["#fff", 0.38]]};
export const PLANKS: Grid = ["AAAAAAAA", "AAaAAAAa", "zzzzzzzz", "AAAAaAAA", "aAAAAAAA", "zzzzzzzz", "AAAaAAAA", "AAAAAAaA"];
export const PSTONE: Grid = ["llllllll", "lSSSSSSs", "lSSSSSSs", "lSSSSSSs", "lSSSSSSs", "lSSSSSSs", "lSSSSSSs", "ssssssss"];
export const SCREEN_L: Grid = ["mmmmmmmm", "mnnnnnnm", "mnnRnnnm", "mnnRRnnm", "mnnRRRnm", "mnnRRnnm", "mnnRnnnm", "mmmmmmmm"];
export const SCREEN_R: Grid = ["mmmmmmmm", "mgmgmgmm", "mmmmmmmm", "mgmgmgmm", "mmmmmmmm", "mgmgmgmm", "mmmmmmmm", "mmmmmmmm"];
export const SCREEN_T: Grid = ["mmmmmmmm", "mggggggm", "mmmmmmmm", "mggggggm", "mmmmmmmm", "mggggggm", "mmmmmmmm", "mmmmmmmm"];
export const SHELF_L: Grid = ["AAAAAAAA", "rbBgyvrb", "rbBgyvrb", "zzzzzzzz", "gyrVbbgy", "gyrVbbgy", "gyrVbbgy", "AAAAAAAA"];
export const SHELF_R: Grid = ["AAAAAAAA", "gyrbvBgr", "gyrbvBgr", "zzzzzzzz", "bVgyrrby", "bVgyrrby", "bVgyrrby", "AAAAAAAA"];
export const STONE: Grid = ["SSsSSSSr", "SrSSSsSS", "SSSSrSSS", "sSSSSSsS", "SSrSSSSS", "SSSsSSrS", "rSSSSSSS", "SSSSsSSs"];

export function palOre(c: string, hi: string): Palette {
  return { ...PAL_STONE, X: [[c, 1]], x: [[hi, 1]] };
}
