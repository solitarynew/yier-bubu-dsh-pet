/** Original shared scene; extracted/restored portraits only for the solo modes. */
(function (root) {
  const art = {
    width: 1536, height: 1024,
    files: ['compact-scene.png', 'compact-cleanplate.png', 'compact-paws.png'],
    cutouts: { file: 'characters-cutout.png', width: 1536, height: 1024 },
    yier: { portrait: [25, 130, 735, 728], paws: [[755, 567, 158, 114], [1083, 639, 175, 116]] },
    bubu: { portrait: [770, 130, 735, 728], paws: [[268, 461, 165, 125], [268, 461, 165, 125]] },
    eyes: [[310, 307, 73, 66], [492, 363, 88, 86], [841, 437, 85, 83], [1040, 504, 94, 94]],
    // Idle paws are taken directly from the original scene, without changing their pose.
    silhouettes: {
      left: 'M776 648 C784 626 815 607 838 616 C878 613 904 640 901 666 C904 687 897 699 874 701 C832 711 777 688 776 673 C766 666 767 658 776 648 Z',
      right: 'M1056 726 C1066 700 1092 684 1122 692 C1156 690 1188 708 1192 736 C1212 766 1200 776 1180 780 C1137 800 1084 780 1058 755 C1046 747 1046 737 1056 726 Z',
      mouse: 'M291 528 C306 502 337 492 362 501 C409 497 435 522 424 547 C425 572 411 588 385 591 C342 609 270 588 280 557 C274 547 284 534 291 528 Z',
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = art;
  else root.YierKeyboardArt = art;
})(typeof window === 'undefined' ? globalThis : window);
