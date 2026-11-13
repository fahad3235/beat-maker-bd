/* Beat Maker BD — i18n.js : English + Bengali strings, Bengali digits. */
(function (root) {
  'use strict';

  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function fmtNum(n, lang) {
    return lang === 'bn' ? toBnDigits(n) : String(n);
  }

  var STRINGS = {
    en: {
      title: 'Beat Maker BD',
      subtitle: '16-step drum machine — tap the grid, press play, make your beat.',
      langToggle: 'বাংলা',
      play: '▶ Play',
      stop: '■ Stop',
      playing: 'Playing…',
      stopped: 'Stopped',
      bpm: 'Tempo',
      bpmUnit: 'BPM',
      swing: 'Swing',
      stepLabel: 'Step',
      beatLabel: 'Beat',
      tracks: { kick: 'Kick', snare: 'Snare', hihat: 'Hi-Hat', clap: 'Clap' },
      mute: 'Mute',
      unmute: 'Unmute',
      volume: 'Volume',
      presets: 'Preset patterns',
      presetNames: {
        'four-on-floor': 'Four-on-Floor',
        'boom-bap': 'Boom Bap',
        'dhol-groove': 'Dhol Groove',
        'half-time': 'Half-Time'
      },
      presetLoaded: 'Preset loaded.',
      myPatterns: 'My patterns',
      patternName: 'Pattern name…',
      savePattern: 'Save pattern',
      patternSaved: 'Pattern saved.',
      patternNameNeeded: 'Type a name first.',
      patternExists: 'A pattern with this name already exists.',
      patternLimit: 'Too many saved patterns (max 20). Delete one first.',
      noSaved: 'No saved patterns yet — build a beat and save it.',
      load: 'Load',
      delete: 'Delete',
      loadedPattern: 'Pattern loaded.',
      deletedPattern: 'Pattern deleted.',
      tools: 'Tools',
      clear: 'Clear grid',
      randomize: 'Randomize',
      cleared: 'Grid cleared.',
      randomized: 'Random beat generated.',
      exportJson: 'Export JSON',
      importJson: 'Import JSON',
      importOk: 'Import complete.',
      importBad: 'That file is not a valid Beat Maker BD export.',
      eraseAll: 'Erase everything',
      eraseHint: 'Type DELETE to erase all patterns, presets and settings.',
      eraseDone: 'Everything erased. Fresh start.',
      exportNote: 'Exports the current beat, tempo, swing and saved patterns.',
      savedCount: 'saved',
      hits: 'hits',
      offlineNote: 'Fully offline — no network, no account, no uploads. Your beats stay on this device.',
      synthNote: 'All drum sounds are synthesized live in your browser (Web Audio) — no audio files.',
      howTitle: 'How to play',
      howBody: 'Tap squares to turn drum hits on or off. The 16 steps are one bar of 16th notes — shaded groups of 4 are the 4 beats. Press Play, change the tempo or swing while it plays, and save any beat you like.',
      stepOn: 'Step on',
      stepOff: 'Step off'
    },
    bn: {
      title: 'বিট মেকার বিডি',
      subtitle: '১৬-স্টেপ ড্রাম মেশিন — গ্রিডে ট্যাপ করুন, প্লে চাপুন, নিজের বিট বানান।',
      langToggle: 'English',
      play: '▶ বাজান',
      stop: '■ থামান',
      playing: 'বাজছে…',
      stopped: 'থেমে আছে',
      bpm: 'গতি',
      bpmUnit: 'বিপিএম',
      swing: 'সুইং',
      stepLabel: 'স্টেপ',
      beatLabel: 'বিট',
      tracks: { kick: 'কিক', snare: 'স্নেয়ার', hihat: 'হাই-হ্যাট', clap: 'ক্ল্যাপ' },
      mute: 'নীরব',
      unmute: 'শব্দ ফেরান',
      volume: 'ভলিউম',
      presets: 'রেডিমেড প্যাটার্ন',
      presetNames: {
        'four-on-floor': 'ফোর-অন-দ্য-ফ্লোর',
        'boom-bap': 'বুম ব্যাপ',
        'dhol-groove': 'ঢোল গ্রুভ',
        'half-time': 'হাফ-টাইম'
      },
      presetLoaded: 'প্যাটার্ন লোড হয়েছে।',
      myPatterns: 'আমার প্যাটার্ন',
      patternName: 'প্যাটার্নের নাম…',
      savePattern: 'সংরক্ষণ করুন',
      patternSaved: 'প্যাটার্ন সংরক্ষিত হয়েছে।',
      patternNameNeeded: 'আগে একটি নাম লিখুন।',
      patternExists: 'এই নামে একটি প্যাটার্ন ইতিমধ্যে আছে।',
      patternLimit: 'অনেক প্যাটার্ন জমে গেছে (সর্বোচ্চ ২০)। আগে একটি মুছুন।',
      noSaved: 'এখনো কোনো প্যাটার্ন সংরক্ষিত হয়নি — একটি বিট বানিয়ে সংরক্ষণ করুন।',
      load: 'লোড',
      delete: 'মুছুন',
      loadedPattern: 'প্যাটার্ন লোড হয়েছে।',
      deletedPattern: 'প্যাটার্ন মোছা হয়েছে।',
      tools: 'টুলস',
      clear: 'গ্রিড মুছুন',
      randomize: 'এলোমেলো বিট',
      cleared: 'গ্রিড মোছা হয়েছে।',
      randomized: 'এলোমেলো বিট তৈরি হয়েছে।',
      exportJson: 'JSON এক্সপোর্ট',
      importJson: 'JSON ইমপোর্ট',
      importOk: 'ইমপোর্ট সম্পন্ন হয়েছে।',
      importBad: 'এই ফাইলটি বৈধ Beat Maker BD এক্সপোর্ট নয়।',
      eraseAll: 'সব মুছে ফেলুন',
      eraseHint: 'সব প্যাটার্ন ও সেটিংস মুছতে DELETE লিখুন।',
      eraseDone: 'সব মুছে ফেলা হয়েছে। নতুন করে শুরু করুন।',
      exportNote: 'বর্তমান বিট, গতি, সুইং ও সংরক্ষিত প্যাটার্ন এক্সপোর্ট হয়।',
      savedCount: 'টি সংরক্ষিত',
      hits: 'হিট',
      offlineNote: 'সম্পূর্ণ অফলাইন — নেটওয়ার্ক নেই, অ্যাকাউন্ট নেই, আপলোড নেই। আপনার বিট এই ডিভাইসেই থাকে।',
      synthNote: 'সব ড্রামের শব্দ ব্রাউজারেই সরাসরি তৈরি হয় (Web Audio) — কোনো অডিও ফাইল নেই।',
      howTitle: 'কীভাবে বাজাবেন',
      howBody: 'বর্গক্ষেত্রে ট্যাপ করে ড্রামের হিট চালু বা বন্ধ করুন। ১৬টি স্টেপ মানে ১৬ ভাগের এক বার — ৪টি করে ছায়াযুক্ত গ্রুপ হলো ৪টি বিট। প্লে চাপুন, বাজতে বাজতে গতি বা সুইং বদলান, আর পছন্দের বিট সংরক্ষণ করুন।',
      stepOn: 'স্টেপ চালু',
      stepOff: 'স্টেপ বন্ধ'
    }
  };

  var api = { STRINGS: STRINGS, toBnDigits: toBnDigits, fmtNum: fmtNum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BeatMakerI18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
