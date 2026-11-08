/**
 * TikTok Live High-Safety Profanity & Sensitive Content Filter
 * Designed specifically for Vietnamese TikTok Live streams
 * Protects against stream bans, shadowbans, and community guideline strikes
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProfanityFilter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // 1. Blacklist Dictionary of Vietnamese and English sensitive phrases
  const BLACKLIST_PHRASES = [
    // --- CHỬI THỀ / TỤC TĨU (PROFANITY) ---
    'đụ', 'đụ má', 'đụ mẹ', 'đụ m', 'duma', 'dume', 'du ma', 'du me', 'đù má', 'đù mẹ',
    'địt', 'địt mẹ', 'địt cụ', 'địt con mẹ', 'địt m', 'địt bà', 'địt mẹ mày', 'địt bố', 'đ!t', 'đ1t',
    'dit', 'dit me', 'dit cu', 'dit con me', 'ditme', 'ditconme', 'dit me may', 'dit ba',
    'đéo', 'đéo mẹ', 'đéo m', 'đéo gì', 'deo', 'deo me', 'đếch',
    'lồn', 'lon', 'l0n', 'loz', 'lol', 'con lồn', 'mặt lồn', 'hãm lồn', 'lồnn', 'lồnnn', 'nứng lồn',
    'cặc', 'cac', 'c4c', 'cax', 'cak', 'kac', 'con cặc', 'đầu cặc', 'bú cặc', 'hút cặc', 'nứng cặc',
    'buồi', 'buoi', 'con buồi', 'đầu buồi', 'bú buồi',
    'dái', 'hòn dái', 'cà dái',
    'bú cu', 'bu cu', 'thổi kèn', 'vét máng', 'vet mang', 'liếm lồn', 'móc lồn', 'moc lon',
    'sục cặc', 'suc cac', 'quay tay', 'thẩm du', 'thủ dâm',
    'đm', 'đmm', 'dmm', 'dcm', 'đcm', 'đkm', 'dkm', 'đckm', 'vcl', 'vl', 'vcc', 'vkl', 'vcll',
    'clmm', 'cmn', 'cmnl', 'vđ', 'vãi lồn', 'vai lon', 'vãi cặc', 'vai cac', 'vãi đái', 'vai dai', 'vãi chưởng',
    'con đĩ', 'thằng chó', 'đồ chó', 'súc sinh', 'súc vật', 'con chó', 'chó đẻ', 'chó má',
    'mẹ mày', 'con mẹ mày', 'bố mày', 'tiên sư', 'tổ sư', 'chết tiệt', 'đồ khốn', 'mất dạy', 'óc chó', 'óc lợn',

    // --- 18+ / KHIÊU DÂM / GÁI GỌI (ADULT / SEXUAL) ---
    'chịch', 'xoạc', 'nứng', 'dâm', 'dâm đãng', 'gái gọi', 'cave', 'bán dâm', 'mua dâm', 'phò', 'đá phò',
    'gái bao', 'sugar baby', 'sugar daddy', 'gạ tình', 'gạ chịch', 'chat sex', 'nude 100%',
    'ấu dâm', 'hiếp dâm', 'cưỡng hiếp', 'loạn luân', 'phọt tinh', 'xuất tinh', 'bắn tinh',
    'lộ clip', 'clip nóng', 'clip 18+', 'show hàng', 'banh háng', 'banh lồn',
    'sex', 'porn', 'hentai', 'jav', 'blowjob', 'handjob', 'dildo', 'xxx',
    'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'dick', 'pussy', 'cunt', 'asshole', 'motherfucker',

    // --- CỜ BẠC / CÁ ĐỘ / KÉO NHÓM (GAMBLING & SCAMS - TIKTOK STRICT) ---
    'tài xỉu', 'tai xiu', 'tàixỉu', 'cá độ', 'ca do', 'cá cược', 'ca cuoc', 'đánh bài', 'casino',
    'xóc đĩa', 'bầu cua', 'nổ hũ', 'game bài', 'baccarat', 'đá gà', 'bắn cá ăn tiền',
    'kubet', 'thabet', 'go88', 'sunwin', 'rikvip', '789club', 'hitclub', 'b52', 'iwin',
    'lô đề', 'lo de', 'số đề', 'so de', 'bao lô', 'soi cầu', 'bạch thủ',
    'kéo tài xỉu', 'kéo nhóm', 'nhóm kéo', 'bao về bờ', 'tool hack tài xỉu', 'tool hack',
    'inbox zalo', 'ib zalo', 'nhóm zalo', 'kéo tele', 'nhóm tele', 'link tele', 't.me/',

    // --- MA TÚY / CHẤT CẤM / BAY LẮC (SUBSTANCES & DRUGS) ---
    'ma túy', 'ma tuy', 'mai thúy', 'mai thuy', 'kẹo ke', 'đập đá', 'ngáo đá', 'cần sa', 'bồ đà', 'cỏ mỹ',
    'bóng cười', 'hút bóng', 'bay lắc', 'bay lac', 'bay phòng', 'thuốc lắc', 'hồng phiến', 'thuốc phiện',

    // --- BẠO LỰC / TỰ HẠI (VIOLENCE & SELF-HARM) ---
    'tự tử', 'tự sát', 'thắt cổ', 'nhảy cầu', 'rạch tay',
    'chém chết', 'đâm chết', 'bắn chết', 'giết người', 'giết mày', 'chém nhau', 'đánh chết', 'tông chết',

    // --- PHÂN BIỆT VÙNG MIỀN / CHÍNH TRỊ (DISCRIMINATION & SENSITIVE) ---
    'bắc kỳ', 'bac ky', 'bake', 'parky', 'paky',
    'nam kỳ', 'nam ky', 'nake', 'namke',
    'ba que', '3 que', 'đu càng', 'phản động', 'khủng bố'
  ];

  // 2. Regex for obfuscated evasion (e.g. d.m, v.c.l, c.ặ.c, f*ck...)
  const EVASION_PATTERNS = [
    /(?:^|[^\p{L}\p{N}])(đ|d)[\s\._\-\*]+(m|k|c|m[\s\._\-\*]*m|c[\s\._\-\*]*m|k[\s\._\-\*]*m)(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])v[\s\._\-\*]+(c[\s\._\-\*]+)?l(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])c[\s\._\-\*]+l[\s\._\-\*]+m[\s\._\-\*]+m(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])(đ|d)[\s\._\-\*]+[uụùúủũư](?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])(đ|d)[\s\._\-\*]+[iịìíĩỉ!1][\s\._\-\*]+t(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])c[\s\._\-\*]+[aàáảãạăằắẳẵặâầấẩẫậ4][\s\._\-\*]+[c|k|x](?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])l[\s\._\-\*]+[oòóỏõọôồốổỗộ0][\s\._\-\*]+[n|z](?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])b[\s\._\-\*]+[uùúủũụ][\s\._\-\*]+[oồ][\s\._\-\*]+i(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])t[\s\._\-\*]+[aàáảãạ][\s\._\-\*]+i[\s\._\-\*]+x[\s\._\-\*]+[iỉìíĩị][\s\._\-\*]+u(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])f[\s\._\-\*]+u[\s\._\-\*]+c[\s\._\-\*]+k(?=[^\p{L}\p{N}]|$)/gui,
    /(?:^|[^\p{L}\p{N}])b[\s\._\-\*]+i[\s\._\-\*]+t[\s\._\-\*]+c[\s\._\-\*]+h(?=[^\p{L}\p{N}]|$)/gui
  ];

  // Sort phrases by descending length for greedy matching
  const SORTED_PHRASES = Array.from(BLACKLIST_PHRASES).sort((a, b) => b.length - a.length);

  // Precompile word-boundary regular expressions
  const COMPILED_PATTERNS = SORTED_PHRASES.map(phrase => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'gui');
  });

  return {
    /**
     * Clean text by replacing all profanities with '***'
     * @param {string} rawText
     * @returns {string} Sanitized text
     */
    clean: function (rawText) {
      if (!rawText || typeof rawText !== 'string') return rawText;
      let text = rawText;

      // 1. Evasion regexes (d.m, v.c.l, c.ặ.c, f*ck...)
      for (const re of EVASION_PATTERNS) {
        text = text.replace(re, (match) => {
          const startNonWord = match.match(/^[^\p{L}\p{N}]+/u);
          const prefix = startNonWord ? startNonWord[0] : '';
          return prefix + '***';
        });
      }

      // 2. Dictionary phrases (longest first, matching with unicode word boundaries)
      for (const pattern of COMPILED_PATTERNS) {
        text = text.replace(pattern, (match, p1) => {
          return match.replace(p1, '***');
        });
      }

      return text;
    },

    /**
     * Check if text contains sensitive profanities
     * @param {string} rawText
     * @returns {boolean}
     */
    isProfane: function (rawText) {
      if (!rawText || typeof rawText !== 'string') return false;
      for (const re of EVASION_PATTERNS) {
        if (re.test(rawText)) return true;
      }
      for (const pattern of COMPILED_PATTERNS) {
        if (pattern.test(rawText)) return true;
      }
      return false;
    }
  };
});
