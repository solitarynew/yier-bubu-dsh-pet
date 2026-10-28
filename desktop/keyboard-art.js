/** Viewports into the locally cached Li-Jiangjiu/YierBubu reference release. */
(function (root) {
  const art = {
    width: 1536, height: 1024,
    files: ['compact-scene.png', 'compact-cleanplate.png', 'compact-paws.png'],
    yier: {
      transform: 'translate(1 -8) scale(.31)',
      outline: 'M918 269 C890 240 891 190 923 162 C967 128 1028 142 1067 202 C1139 191 1213 207 1272 237 C1310 202 1354 214 1390 253 C1448 309 1458 413 1432 499 C1454 578 1412 658 1345 699 C1324 715 1285 733 1246 739 C1272 758 1285 793 1286 820 L815 664 L825 640 C792 617 772 586 771 551 C765 507 781 468 813 436 C821 365 863 304 918 269 Z',
      eyes: [[841, 437, 85, 83], [1040, 504, 94, 94]],
      paws: [[755, 567, 158, 114], [1083, 639, 175, 116]],
    },
    bubu: {
      transform: 'translate(160 25) scale(.333333)',
      outline: 'M356 150 C333 107 340 56 381 28 C438 -8 505 15 534 81 C594 78 650 94 691 117 C728 72 793 72 837 117 C880 157 877 219 835 250 C856 302 857 359 840 411 C817 473 774 516 709 545 C730 568 739 604 739 645 L295 496 L312 480 C270 459 244 426 237 385 C230 351 243 324 273 303 C282 235 314 184 356 150 Z',
      // The neighbouring white bear occludes this corner in the shared source plate.
      sourceClip: 'M0 0 H1536 V280 H906 C858 310 832 361 815 423 C781 453 765 493 771 550 L680 554 C565 571 455 529 355 489 L0 480 Z',
      eyes: [[310, 307, 73, 66], [492, 363, 88, 86]],
      paws: [[268, 461, 165, 125], [268, 461, 165, 125]],
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = art;
  else root.YierKeyboardArt = art;
})(typeof window === 'undefined' ? globalThis : window);
