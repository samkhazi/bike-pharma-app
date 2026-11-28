// The service advisors' job card portal (Sam, 28 Nov 2026: "kitne job card bane, kaun se pending, kisko assign kiya hua hai,
// ye job card kitna baaki hai, online bookings kitni aayi ... ekdam accurate"): the Bike Surgeon billing's own job cards,
// online bookings and mechanics, read only, fresh every 3 seconds (server/billing.js asks the billing with the service app's
// own rules). A new job card is made here (newjc.js, update 13) once the server has the billing's job card login; till then,
// and for an approval or a booking, the buttons open the service app.
'use strict';
(() => {
const LOGO_PATH="M392.8 91.6C392.1 91.4 392.0 90.9 392.0 86.3L392.0 82.0L392.4 81.6L392.8 81.2L403.0 81.2C415.2 81.1 416.3 81.1 417.4 80.4C419.0 79.4 419.6 77.7 419.6 74.1C419.6 72.0 419.6 72.0 419.1 71.5L418.7 71.1L410.0 71.0C402.5 70.9 401.1 70.8 400.3 70.6C399.8 70.5 398.9 70.2 398.3 70.1C397.6 69.9 396.9 69.7 396.5 69.5C396.2 69.3 395.7 69.2 395.3 69.1C394.1 68.8 391.0 66.9 389.2 65.3C388.0 64.2 387.4 63.2 386.1 60.8C385.5 59.7 384.8 58.3 384.5 57.8C384.2 57.1 384.0 56.6 384.0 56.1C384.0 55.6 383.8 54.9 383.6 54.3C383.2 53.3 383.1 53.0 383.0 49.7C382.8 44.4 383.0 39.6 383.5 38.6C383.7 38.1 383.9 37.3 384.0 36.8C384.1 36.2 384.4 35.4 384.6 35.0C384.8 34.5 385.0 34.1 385.0 34.0C385.0 33.6 386.1 31.4 386.8 30.4C388.7 28.0 391.2 25.8 393.8 24.7C394.6 24.3 395.4 24.0 395.4 24.0C395.5 24.0 396.0 23.8 396.5 23.6C397.0 23.3 397.9 23.1 398.5 23.0C399.1 22.9 399.9 22.7 400.4 22.6C402.4 22.0 404.4 22.0 418.4 22.0L432.2 22.1L432.5 22.5L432.9 22.8L433.0 50.3L433.0 77.7L432.5 79.2C432.2 80.0 432.0 80.9 432.0 81.2C432.0 82.1 430.7 84.4 429.5 85.8C428.1 87.4 426.7 88.4 424.7 89.4C423.8 89.8 422.8 90.4 422.5 90.5C421.7 90.9 419.8 91.3 417.2 91.5C414.9 91.7 393.3 91.8 392.8 91.6ZM517.8 71.4C517.0 71.3 515.4 71.1 514.3 71.0C512.9 70.9 512.2 70.8 511.7 70.5C511.3 70.3 510.7 70.1 510.2 70.0C507.1 69.3 501.6 65.4 500.0 62.7C499.5 61.9 499.0 61.1 498.9 60.8C498.8 60.6 498.7 60.2 498.5 60.0C498.0 59.3 497.0 57.3 497.0 57.0C497.0 56.9 496.8 56.3 496.5 55.7C495.8 54.1 495.8 52.8 496.4 52.3C496.9 52.0 497.1 52.0 501.4 52.0C506.9 52.0 506.7 51.9 508.2 54.6C508.8 55.8 510.9 57.9 512.5 58.9C514.8 60.5 519.6 62.0 521.7 61.8C523.3 61.6 526.2 60.9 527.7 60.3C531.7 58.6 535.9 54.0 534.3 53.2C534.0 53.0 532.0 53.0 527.2 53.0C519.2 53.0 519.8 53.1 518.6 51.1C517.2 48.6 516.3 46.8 516.3 46.1C516.3 45.5 516.9 44.2 518.1 42.5C518.4 42.0 518.8 41.3 519.0 40.9C519.6 39.8 519.7 39.8 527.0 39.9C534.4 39.9 534.5 39.9 534.5 38.6C534.5 37.8 533.1 36.0 531.4 34.7C530.7 34.1 529.7 33.2 529.2 32.7C528.0 31.7 527.2 31.2 525.9 31.0C525.4 30.9 524.5 30.7 523.9 30.5C522.4 30.0 519.8 30.0 518.1 30.6C517.4 30.8 516.7 31.0 516.6 31.0C515.1 31.0 509.8 35.2 508.5 37.4C507.7 38.9 506.5 40.3 506.1 40.5C505.8 40.6 504.2 40.7 501.2 40.7L496.8 40.7L496.4 40.3C495.9 39.7 495.9 38.7 496.4 37.5C496.7 37.0 497.0 36.2 497.1 35.8C497.7 33.6 499.5 30.5 501.4 28.4C503.5 26.0 509.7 22.5 512.8 22.1C513.2 22.0 514.1 21.8 514.7 21.7C517.7 20.8 524.1 20.8 528.0 21.7C528.8 21.8 529.8 22.0 530.2 22.1C533.5 22.9 538.0 25.3 540.3 27.5C543.0 30.2 543.9 31.5 545.0 34.6C545.2 35.0 545.4 35.7 545.6 36.1C545.9 36.5 546.0 37.0 546.0 37.6C546.0 38.1 546.2 38.8 546.5 39.5L547.0 40.7L547.1 46.7L547.1 52.6L546.6 53.8C546.3 54.4 546.0 55.3 545.9 55.8C545.8 56.6 545.5 57.4 543.5 60.9C542.5 62.8 542.1 63.3 541.0 64.4C539.3 66.0 537.2 67.6 536.4 67.9C536.0 68.0 535.3 68.3 534.9 68.6C534.4 68.8 534.0 69.0 533.9 69.0C533.8 69.0 533.3 69.2 533.0 69.3C531.7 70.0 528.4 71.0 527.5 71.0C527.0 71.0 525.7 71.1 524.8 71.3C522.6 71.7 520.2 71.7 517.8 71.4ZM2.8 70.7C2.5 70.6 2.3 70.3 2.2 69.9C2.0 69.1 1.9 5.8 2.2 4.7C2.2 4.3 2.5 3.8 2.7 3.5L3.2 3.1L25.5 3.1L47.8 3.1L48.9 3.5C51.7 4.4 55.7 6.6 57.2 8.1C58.5 9.4 60.2 11.8 61.1 13.8C61.8 15.3 61.9 15.5 62.1 17.7C62.6 24.2 62.2 26.3 59.6 30.4C59.1 31.2 58.5 32.2 58.2 32.7C57.5 33.9 56.7 34.7 55.1 35.7C53.8 36.5 53.8 36.6 53.8 37.2C53.8 37.7 53.9 37.8 55.2 38.9C58.6 41.4 60.4 43.5 60.9 45.5C61.1 46.0 61.3 46.8 61.6 47.4C62.5 49.8 62.4 57.6 61.4 59.7C61.2 60.2 61.0 60.8 61.0 61.1C61.0 61.7 60.2 63.2 59.2 64.7C58.2 66.3 55.5 68.3 53.6 69.0C53.1 69.2 52.5 69.4 52.2 69.6C51.8 69.8 51.0 69.9 50.3 70.0C49.6 70.1 48.5 70.3 47.9 70.5L46.8 70.9L25.0 71.0C6.0 71.0 3.2 71.0 2.8 70.7ZM73.9 70.8C73.0 70.5 73.0 71.7 73.0 46.6C73.0 30.2 73.1 23.4 73.2 23.0C73.5 22.0 73.8 22.0 79.7 21.9C86.1 21.8 86.1 21.8 86.5 23.5C86.7 24.4 86.7 69.9 86.5 70.3C86.4 70.5 86.1 70.7 85.8 70.8C85.2 71.0 74.4 71.1 73.9 70.8ZM101.2 70.8C100.2 70.4 100.3 73.0 100.3 36.9C100.3 16.8 100.4 3.8 100.5 3.7C100.8 3.1 101.6 3.0 107.1 3.0C113.0 3.0 113.2 3.0 113.6 3.9C113.8 4.2 113.9 7.8 113.9 21.9C113.9 40.4 113.9 40.2 114.7 40.2C114.8 40.2 115.5 39.6 116.3 38.7C117.0 37.9 118.2 36.7 118.9 36.0C119.6 35.3 120.8 33.9 121.6 32.9C123.5 30.6 131.4 22.4 132.2 22.1C133.1 21.7 145.3 21.8 145.5 22.2C145.8 22.7 145.5 23.0 141.0 27.5C138.5 30.0 136.2 32.4 135.9 32.8C135.7 33.1 134.2 34.8 132.5 36.4C129.1 39.8 128.8 40.1 129.3 40.7C129.6 41.0 129.8 41.1 131.3 41.1C136.5 41.2 141.4 43.7 142.0 46.5C142.1 47.0 142.3 47.7 142.5 48.0C142.7 48.4 142.9 49.3 143.0 49.9C143.1 50.6 143.3 51.5 143.5 51.9L143.9 52.8L144.0 61.5L144.0 70.2L143.6 70.6L143.2 71.0L137.5 71.0L131.8 71.0L131.4 70.6L131.0 70.2L131.0 64.4C131.0 58.3 130.9 57.4 130.2 55.3C129.2 52.1 127.9 51.7 119.4 51.7L114.8 51.7L114.3 52.1L113.9 52.6L113.9 61.3L113.9 70.0L113.5 70.5L113.0 70.9L107.3 71.0C104.2 71.0 101.4 70.9 101.2 70.8ZM173.3 70.8C172.9 70.8 172.1 70.5 171.4 70.4C170.8 70.2 169.9 70.0 169.5 70.0C168.9 70.0 168.2 69.8 167.3 69.4C166.5 69.1 165.5 68.6 165.0 68.4C164.5 68.2 163.9 68.0 163.7 67.9C163.0 67.7 161.5 66.8 160.5 66.0C160.0 65.6 159.3 65.0 158.9 64.8C158.2 64.3 156.8 62.4 156.0 60.9C155.9 60.6 155.3 59.5 154.9 58.6C154.4 57.7 154.0 56.8 154.0 56.6C154.0 56.4 153.8 55.8 153.6 55.3C153.2 54.6 153.1 54.0 153.0 52.5C152.9 51.4 152.7 49.9 152.6 49.0C152.3 46.9 152.3 45.6 152.7 43.1C152.8 41.9 153.0 40.5 153.0 39.9C153.0 39.2 153.1 38.7 153.5 37.9C153.8 37.4 154.0 36.7 154.0 36.5C154.0 36.3 154.2 35.7 154.4 35.2C154.6 34.8 154.9 34.0 155.1 33.6C156.1 30.1 160.9 25.4 165.0 23.9C170.1 22.0 169.9 22.0 183.8 22.0L195.2 22.1L195.5 22.5C195.9 22.8 195.9 23.0 196.0 26.5C196.0 30.5 196.0 30.7 195.4 31.3L195.0 31.7L185.3 31.7C172.5 31.7 172.9 31.6 170.2 34.1C168.6 35.6 168.2 36.2 167.9 38.0C167.5 39.7 167.6 40.4 168.2 40.8C168.3 40.9 174.4 41.0 181.7 41.0L195.0 41.1L195.5 41.5L195.9 42.0L195.9 46.4C195.9 50.6 195.9 50.7 195.6 51.0C195.0 51.4 191.3 51.5 178.9 51.5L168.3 51.4L167.8 51.9C167.1 52.6 167.1 53.1 167.6 54.4C167.8 55.1 168.0 55.8 168.1 56.1C168.1 56.3 168.7 57.0 169.3 57.7C170.6 59.1 171.9 59.8 173.7 60.0C174.4 60.1 175.4 60.2 176.0 60.3C176.6 60.4 181.1 60.5 186.1 60.6L195.1 60.7L195.5 61.2L196.0 61.6L196.0 65.7C196.0 70.1 195.9 70.5 195.2 70.8C194.8 71.0 174.6 71.0 173.3 70.8ZM208.4 70.6C207.8 70.1 207.7 69.0 207.7 64.4C207.7 60.2 207.8 59.6 208.7 59.2C209.0 59.1 213.1 59.0 226.4 59.0C235.9 59.0 244.0 58.9 244.3 58.9C248.4 57.9 250.3 56.7 251.5 54.6C251.9 53.8 251.9 53.6 251.9 51.4C251.9 49.2 251.9 49.0 251.4 47.5C250.4 44.9 248.6 43.4 245.9 42.9C245.2 42.8 244.1 42.6 243.4 42.4C242.4 42.2 240.8 42.1 231.4 42.0L220.6 41.9L219.3 41.4C218.6 41.2 217.7 41.0 217.5 41.0C217.2 41.0 216.5 40.8 216.1 40.6C215.6 40.4 214.8 40.1 214.3 39.9C213.1 39.6 210.7 38.0 209.1 36.4C207.7 35.1 206.6 33.2 206.0 31.4C205.9 31.1 205.6 30.4 205.4 29.9C205.2 29.5 205.0 28.8 205.0 28.6C205.0 28.3 204.8 27.6 204.7 27.0C204.1 25.2 204.0 22.8 204.6 20.6C204.8 19.7 205.0 18.4 205.0 17.8C205.0 17.0 205.1 16.5 205.4 15.9C205.6 15.4 205.9 14.7 206.0 14.4C206.2 13.7 208.3 10.4 209.3 9.3C211.2 7.1 213.0 5.9 215.8 4.9C216.4 4.7 217.5 4.3 218.2 3.9C220.1 3.0 220.6 3.0 243.7 3.0L263.2 3.0L263.6 3.4L264.0 3.8L264.0 8.9C263.9 13.9 263.9 14.0 263.6 14.4L263.2 14.7L245.4 14.7C226.0 14.8 224.7 14.8 223.4 15.6C222.2 16.3 221.2 17.4 221.0 18.1C220.9 18.5 220.6 19.2 220.4 19.7C220.0 20.5 220.0 20.8 220.0 22.7C220.0 24.7 220.0 24.8 220.6 26.0C221.4 27.5 222.1 28.3 223.7 29.2L224.9 29.9L227.2 30.0C228.5 30.1 233.9 30.2 239.2 30.2C247.1 30.3 249.0 30.4 250.0 30.6C250.7 30.7 252.1 30.9 253.2 31.0C256.1 31.3 256.8 31.7 262.5 36.3C264.0 37.5 266.0 40.1 266.0 40.8C266.0 41.0 266.2 41.5 266.4 42.0C266.7 42.5 267.0 43.5 267.1 44.2C267.2 44.9 267.5 45.8 267.6 46.3C268.1 47.9 268.0 54.0 267.5 55.1C267.3 55.5 267.1 56.4 267.0 56.9C266.9 57.5 266.7 58.3 266.4 58.8C266.2 59.3 266.0 59.7 266.0 59.8C266.0 60.9 263.3 65.2 261.8 66.6C260.2 68.0 256.3 69.8 254.6 70.0C253.8 70.1 252.7 70.3 252.0 70.5L250.8 70.9L229.8 71.0L208.9 71.0L208.4 70.6ZM292.6 70.8C292.0 70.8 291.1 70.6 290.5 70.4C290.0 70.2 289.2 70.0 288.8 70.0C288.1 70.0 287.4 69.7 284.5 68.3C281.9 67.0 279.0 63.3 279.0 61.2C279.0 60.9 278.8 60.1 278.5 59.6L278.1 58.6L278.0 40.6L278.0 22.7L278.4 22.3C278.9 22.0 279.1 22.0 284.3 22.0C290.1 22.0 290.5 22.0 290.8 22.8C290.9 23.1 291.0 27.8 291.0 39.0L291.0 54.9L291.4 56.1C292.3 58.7 292.9 59.4 295.0 60.1L296.2 60.6L302.9 60.5C310.2 60.5 310.2 60.5 310.7 59.5C311.0 59.1 311.0 56.8 311.0 40.9L311.0 22.8L311.4 22.4L311.8 22.0L317.6 22.0L323.4 22.1L323.7 22.5C324.0 22.9 324.0 23.5 324.0 46.5L324.0 70.2L323.6 70.6L323.2 71.0L308.4 71.0C300.2 71.0 293.1 70.9 292.6 70.8ZM338.4 70.6L338.0 70.2L338.0 46.5L338.0 22.8L338.4 22.4L338.8 22.0L352.1 22.0L365.4 22.1L367.4 22.7C372.3 24.2 374.2 25.4 375.6 28.5C375.8 29.0 376.0 29.6 376.0 29.9C376.0 30.1 376.2 30.8 376.5 31.4L376.9 32.4L377.0 37.5L377.0 42.5L376.6 42.9L376.2 43.3L370.9 43.3C363.9 43.3 364.4 43.6 364.1 39.3C363.9 36.0 363.5 34.9 362.0 33.6C360.2 32.1 359.4 31.8 354.7 31.6L352.6 31.5L352.0 31.9C351.7 32.2 351.4 32.6 351.3 32.8C351.2 33.0 351.2 41.1 351.2 51.4C351.2 63.3 351.1 69.8 351.0 70.1C350.7 71.0 350.4 71.0 344.4 71.0L338.8 71.0L338.4 70.6ZM464.9 70.8C464.5 70.8 463.4 70.6 462.6 70.4C461.8 70.2 460.7 69.9 460.2 69.9C458.8 69.6 455.6 68.4 453.9 67.5C453.0 67.1 449.8 64.8 449.0 64.1C448.3 63.4 445.0 57.6 445.0 56.9C445.0 56.8 444.8 56.1 444.5 55.5C444.1 54.5 444.0 54.2 444.0 52.8C444.0 51.9 443.9 50.8 443.7 50.2C443.3 48.4 443.2 44.9 443.6 42.5C443.8 41.4 444.0 40.0 444.0 39.5C444.0 38.9 444.1 38.4 444.3 37.9C444.7 37.3 444.9 36.6 445.9 33.8C447.1 30.3 450.2 26.9 453.7 24.9C455.8 23.7 459.3 22.5 461.6 22.2C463.6 21.9 485.4 21.9 486.1 22.2C486.9 22.6 487.0 23.2 487.0 27.3L486.9 30.9L486.5 31.2C486.1 31.6 486.0 31.6 476.7 31.6C467.3 31.7 464.8 31.8 463.8 32.2C461.8 33.1 459.3 35.7 459.1 37.2C459.0 37.5 458.8 38.2 458.6 38.7C458.2 39.6 458.2 39.7 458.4 40.1C458.8 41.0 458.1 41.0 476.8 41.0L494.2 41.0L494.6 41.4L495.0 41.8L495.0 46.3C494.9 50.8 494.9 50.9 494.5 51.2C494.2 51.5 493.5 51.5 477.0 51.4C458.4 51.4 459.0 51.3 458.4 52.2C458.0 52.8 458.1 53.9 458.7 55.5C459.6 57.6 461.8 59.4 464.1 59.8C467.9 60.5 468.7 60.6 477.1 60.6C481.7 60.6 485.7 60.7 486.0 60.8C486.9 60.9 487.0 61.3 487.0 66.0L487.0 70.2L486.6 70.6L486.2 71.0L476.0 71.0C470.3 71.0 465.4 70.9 464.9 70.8ZM558.4 70.6L558.0 70.2L558.0 46.7C558.0 29.6 558.1 23.1 558.2 22.8C558.5 22.0 558.4 22.0 574.4 22.0L589.6 22.1L591.7 22.6C597.6 24.2 600.1 26.1 602.3 30.9C603.0 32.3 603.0 32.5 603.0 33.9C603.0 34.9 603.1 35.9 603.4 36.8C603.7 38.1 603.7 38.3 603.8 54.0L603.9 70.0L603.4 70.4L603.0 70.9L597.2 70.9L591.3 70.9L590.9 70.5C590.3 69.8 590.3 68.6 590.3 52.6C590.4 39.4 590.3 38.0 590.1 36.8C589.8 35.4 589.2 34.4 588.0 33.2C586.5 31.7 586.7 31.8 579.3 31.7C572.5 31.6 572.1 31.6 571.5 32.3L571.1 32.7L571.0 51.5L570.9 70.4L570.5 70.7C570.2 71.0 569.8 71.0 564.5 71.0L558.8 71.0L558.4 70.6ZM418.8 60.3C419.7 59.7 419.7 60.0 419.7 45.9L419.7 32.6L419.1 32.2L418.6 31.7L413.0 31.7C406.0 31.7 404.2 31.9 403.1 32.7C402.7 33.0 401.9 33.5 401.5 33.8C401.0 34.1 400.4 34.5 400.2 34.7C398.9 35.9 397.0 39.1 397.0 40.2C397.0 40.5 396.8 41.8 396.6 43.2C396.1 45.9 396.1 47.5 396.7 49.8C396.8 50.6 397.0 51.6 397.0 52.0C397.0 54.5 399.8 58.2 402.6 59.3C403.7 59.8 405.9 60.3 407.4 60.6C407.7 60.6 410.3 60.6 413.2 60.6C417.9 60.6 418.5 60.6 418.8 60.3ZM42.3 58.2C44.2 57.3 45.2 56.3 46.2 54.4C47.1 52.5 47.3 50.4 46.7 48.7C46.5 48.2 46.2 47.4 46.1 47.0C45.6 45.6 43.9 44.1 41.3 43.2C41.1 43.1 36.2 43.0 29.1 43.0C16.4 42.9 16.7 42.9 16.3 43.8C16.1 44.4 16.1 57.7 16.4 58.2C16.7 59.0 16.7 59.0 29.1 58.9L40.9 58.9L42.3 58.2ZM41.1 30.4C43.9 29.5 45.5 28.2 46.0 26.6C46.1 26.2 46.4 25.5 46.6 25.1C47.2 23.8 47.2 22.0 46.5 20.5C46.3 19.9 45.9 19.1 45.8 18.6C45.4 17.5 43.9 16.2 42.3 15.5C40.7 14.8 38.8 14.7 26.2 14.7C16.8 14.8 16.8 14.8 16.3 15.7C16.2 15.9 16.1 18.2 16.1 22.8C16.1 29.0 16.1 29.7 16.4 30.1C17.0 31.0 16.9 31.0 28.6 31.0L39.4 31.0L41.1 30.4ZM76.8 15.8C74.0 15.8 74.0 15.7 73.5 15.3L73.1 14.8L73.0 9.8C73.0 4.2 73.0 3.7 73.8 3.3C74.5 2.9 85.1 2.9 85.8 3.2C86.6 3.6 86.6 4.1 86.6 9.4C86.7 16.2 86.9 15.8 82.4 15.9C80.9 15.9 78.3 15.9 76.8 15.8Z";
const LOGO_BARS=[[122.5,2.2,73.8,11.7],[277.0,2.3,327.3,11.5],[443.0,81.0,161.0,11.3],[1.8,81.2,375.8,11.2]];
const logo=(txt,cls='')=>`<svg class="${cls}" viewBox="0 0 606 94" role="img" aria-label="Bike Surgeon">${LOGO_BARS.map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#F8C018"/>`).join('')}<path d="${LOGO_PATH}" fill="${txt}" fill-rule="evenodd"/></svg>`;
const OLD = 'https://service.bikesurgeon.online/app/';
const I = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h5"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', chev: '<path d="m9 18 6-6-6-6"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 9h8M8 13h6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
};
const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pill = (t, c) => `<span class="pill p-${c}">${esc(t)}</span>`;
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;
const tel = p => String(p || '').replace(/[^\d+]/g, '');
const initials = n => { const w = String(n || '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/); return (((w[0] || '')[0] || '') + ((w[1] || '')[0] || (w[0] || '').slice(1, 2))).toUpperCase(); };

// ---------------- time: the workshop's clock (Indian time) from the server; times of the billing are 'YYYY-MM-DD HH:MM'
const ms = t => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(t || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN; };
let SKEW = null;
const nowMs = () => Date.now() + (SKEW || 0);
const ymdOf = x => { const d = new Date(x); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const todayYmd = () => ymdOf(nowMs());
function setNow(s) { const t = ms(s); if (!Number.isFinite(t)) return; const est = nowMs(); if (SKEW === null || Math.abs(est - (t + 30000)) > 60000) SKEW = t + 30000 - Date.now(); }
const clock = t => { const h = +t.slice(11, 13); return `${((h + 11) % 12) + 1}:${t.slice(14, 16)} ${h < 12 ? 'am' : 'pm'}`; };
// 'Today 12:15 pm', 'Yesterday 3:05 pm', 'Tomorrow', '24 Nov, 12:15 pm', '24 Feb 2025, 9:10 am'
function when(t, time = true) {
  if (!t || !Number.isFinite(ms(t))) return '';
  const d = t.slice(0, 10), td = todayYmd(), yd = ymdOf(ms(td) - 864e5), tm = ymdOf(ms(td) + 864e5);
  const near = d === td || d === yd || d === tm;
  const day = d === td ? 'Today' : d === yd ? 'Yesterday' : d === tm ? 'Tomorrow' : `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}${d.slice(0, 4) !== td.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;
  return time && t.length >= 16 ? `${day}${near ? ' ' : ', '}${clock(t)}` : day;
}
// a time saved at the front door (UTC, ISO) as Indian time 'YYYY-MM-DD HH:MM'
const istOf = iso => { const x = Date.parse(iso || ''); if (!Number.isFinite(x)) return ''; const d = new Date(x + 330 * 60000); return `${ymdOf(d.getTime())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const mins = (a, b) => { const x = (ms(a) - ms(b)) / 60000; return Number.isFinite(x) ? x : null; };
const since = t => { const x = (nowMs() - ms(t)) / 60000; return Number.isFinite(x) ? Math.max(0, x) : null; };
function dur(m) {
  if (m === null || !Number.isFinite(m)) return '';
  m = Math.max(0, Math.round(m));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d >= 7 || !h ? plural(d, 'day') : `${d}d ${h}h`;
}

// ---------------- a job card's state, as the service app's tabs say it -------------------------------------------------------
const paused = c => c.tab === 'c' && c.st === 'STREAM_STOPPED';
const completed = c => c.tab === 'c' && !paused(c);
function stat(c) {
  if (c.tab === 'p') return ['Pending approval', 'violet'];
  if (c.tab === 'o') return ['Ongoing', 'blue'];
  if (paused(c)) return ['Paused', 'orange'];
  if (c.tab === 'c') return ['Completed', 'green'];
  if (c.tab === 'n') return ['Not approved', 'red'];
  return [c.st ? `Status: ${c.st}` : 'No status', 'gray'];
}
// how much of the job card is left: [text, tone]
function left(c) {
  if (c.tab === 'p') { const w = since(c.at); return [w === null ? 'Waiting for approval' : `Waiting for approval ${dur(w)}`, 'violet']; }
  if (c.tab === 'o') {
    if (c.due) { const m = (ms(c.due) - nowMs()) / 60000; if (Number.isFinite(m)) return m >= 0 ? [`${dur(m)} left`, m < 30 ? 'orange' : 'green'] : [`Late by ${dur(-m)}`, 'red']; }
    const w = since(c.go || c.at); return [w === null ? 'In work · no delivery time' : `In work ${dur(w)} · no delivery time`, 'gray'];
  }
  if (paused(c)) return ['Paused · a job of more than one day', 'orange'];
  if (c.tab === 'c') { const t = c.go && c.done ? mins(c.done, c.go) : null; return [`Out ${when(c.done) || '—'}${t > 0 ? ` · service time ${dur(t)}` : ''}`, 'green']; }
  if (c.tab === 'n') return ['Zero bill · customer said no', 'red'];
  return ['In no tab of the service app', 'gray'];
}
function billPill(c) {
  const b = c.bill;
  if (!b) return completed(c) ? pill('Not billed', 'gray') : '';
  if (b.st === 'PAID') return pill('Paid', 'green');
  if (b.st === 'CREDIT') return pill('Credit', 'orange');
  return pill(b.st ? `Bill ${b.st.toLowerCase()}` : 'Bill not paid', 'orange');
}
function dots(c) {
  const ap = c.ap === 'APPROVED' || c.tab === 'o' || c.tab === 'c';
  const s = [1, c.tab === 'n' ? 'red' : ap, !!c.mid, completed(c), !!c.bill];
  return `<span class="dots" title="Made · Approved · Mechanic · Completed · Billed">${s.map(x => `<i class="${x === 'red' ? 'red' : x ? 'on' : ''}"></i>`).join('')}</span>`;
}
function prLine(c) {
  const p = c.pr; if (!p || !(c.tab === 'p' || c.tab === 'o')) return '';
  if (p.wait) return `<small class="tone-red">${ic('box')} Spares asked ${dur(since(p.at))} ago · nobody attended</small>`;
  if (p.chk) return `<small class="tone-blue">${ic('box')} Stock being checked (${plural(p.chk, 'part')})</small>`;
  return '';
}
function row(c) {
  const [lt, tone] = left(c), [sl, sc] = stat(c), model = [c.mk, c.mo].filter(Boolean).join(' ');
  const tags = [c.pkg ? pill(c.pkg, 'yel') : '', c.free ? pill('Free service', 'teal') : ''].join('');
  return `<a class="jrow" href="#jc-${c.id}">
  <div class="c1"><span class="jno">#${c.id}</span><small>${esc(when(c.at) || '—')}</small></div>
  <div><span class="t mono">${esc(c.p || '—')}</span><small>${esc(model || '—')}</small></div>
  <div><span class="t">${esc(c.n || '—')}</span><small class="mono">${esc(c.ph)}</small></div>
  <div><span class="svc">${esc(c.svc || '—')}</span>${tags ? `<span class="tags">${tags}</span>` : ''}</div>
  <div><span class="t ${c.mech ? '' : c.tab === 'o' || c.tab === 'p' ? 'tone-orange' : 'tone-gray'}">${esc(c.mech || 'No mechanic')}</span><small>${esc(c.bay || 'No bay')}</small></div>
  <div>${pill(sl, sc)}<small class="tone-${tone}">${esc(lt)}</small>${prLine(c)}${dots(c)}</div>
  <div><span class="t">${esc(c.by || '—')}</span>${billPill(c)}${c.due && c.tab !== 'c' && c.tab !== 'n' ? `<small>Expected ${esc(when(c.due))}</small>` : ''}</div>
 </a>`;
}
const HEAD = '<div class="jhead"><span>Job card</span><span>Vehicle</span><span>Customer</span><span>Service</span><span>Mechanic · bay</span><span>Status · time left</span><span>Advisor · bill</span></div>';

// ---------------- state ----------------------------------------------------------------------------------------------------------
let ME = null, D = null, D0 = null, LINK = null, NET = '', LIST = null, JC = null, JCERR = '', VR = {}, BUSY = false, NJON = false;
const UI = { route: 'today', param: '', authed: false, ready: false, tab: 'p', q: '', mine: false, age: '', bk: 'pending', menu: false };
const inShell = window.top !== window;

async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
  if (r.status === 401 && url !== '/auth/login' && UI.authed) { UI.authed = false; render(); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
  return d;
}
async function load() {
  try { const st = await api('GET', '/state'); ME = st.me || null; NJON = !!st.newjc; UI.authed = true; } catch { UI.authed = false; }
  UI.ready = true; render();
  if (UI.authed) { await poll(); routeLoad(); }
}
let polling = false;
async function poll(force) {
  if (!UI.authed || polling || (document.hidden && !force)) return;
  polling = true;
  try {
    const d = await api('GET', '/live?rev=' + encodeURIComponent(D ? D.rev : ''));
    NET = ''; LINK = d.link || null; if (d.now) setNow(d.now);
    if (d.same) { chip(); return; }
    // the New job card page is not drawn again by the poll (the photos being picked, a half-typed line): only the chip
    const draw = () => { if (UI.route === 'new') chip(); else render(); };
    if (!d.ready) { D0 = d; draw(); return; }
    D = d; D0 = null;
    draw();
    if (UI.route === 'jobs') loadList(true);
    if (UI.route === 'jc') loadJc();
  } catch (e) { NET = e.message; chip(); }
  finally { polling = false; }
}
// the job cards page: one tab, searched, newest first
let LSEQ = 0;
const listKey = () => JSON.stringify([UI.tab, UI.q.trim(), UI.mine, UI.age]);
const listUrl = (n, before) => `/live/list?tab=${UI.tab}&q=${encodeURIComponent(UI.q.trim())}&mine=${UI.mine ? 1 : 0}&age=${UI.age}&n=${n}${before ? '&before=' + before : ''}`;
async function loadList(keep) {
  const key = listKey(), n = keep && LIST && LIST.key === key && LIST.cards ? Math.min(200, Math.max(100, LIST.cards.length)) : 100, seq = ++LSEQ;
  try { const d = await api('GET', listUrl(n)); if (seq === LSEQ) { LIST = { ...d, key }; render(); } }
  catch (e) { if (seq === LSEQ) { LIST = { key, err: e.message, cards: [] }; render(); } }
}
async function more() {
  if (!LIST || !LIST.more || BUSY || !LIST.cards.length) return;
  BUSY = true; render();
  try { const d = await api('GET', listUrl(100, LIST.cards[LIST.cards.length - 1].id)); if (LIST.key === listKey()) { LIST.cards = LIST.cards.concat(d.cards || []); LIST.more = !!d.more; } }
  catch (e) { toast(e.message); }
  finally { BUSY = false; render(); }
}
async function loadJc() {
  const id = Math.floor(+UI.param); if (!(id > 0)) return;
  try { const d = await api('GET', '/live/jc/' + id); if (UI.route === 'jc' && +UI.param === id) { JC = d; JCERR = ''; render(); loadVr(d.jc.p); } }
  catch (e) { if (UI.route === 'jc' && +UI.param === id) { JC = null; JCERR = e.message; render(); } }
}
// the vehicle's VR Garage details saved at the front door (never asks VR Garage; outside the one screen there are none)
const regKey = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
async function loadVr(p) {
  const k = regKey(p); if (!k || VR[k] !== undefined) return;
  VR[k] = null;
  try { const r = await fetch('/__gate/api/vehicle?no=' + encodeURIComponent(k), { credentials: 'same-origin', cache: 'no-store' }); VR[k] = r.ok ? await r.json() : { err: r.status }; }
  catch { VR[k] = { err: 0 }; }
  if (UI.route === 'jc') render();
}
function routeLoad() {
  if (UI.route === 'jobs' && (!LIST || LIST.key !== listKey())) loadList();
  if (UI.route === 'jc' && (!JC || JC.jc.id !== +UI.param)) { JC = null; JCERR = ''; loadJc(); }
  if (UI.route === 'new' && window.BSF && BSF.onNew) BSF.onNew(UI.param);
}
function go(route, param = '') {
  UI.route = route; UI.param = String(param); UI.menu = false;
  try { history.pushState(null, '', '#' + route + (param !== '' ? '-' + param : '')); } catch { /* sandboxed */ }
  render(); window.scrollTo(0, 0); routeLoad();
}
function fromHash() {
  const h = decodeURIComponent((location.hash || '').slice(1));
  let m = h.match(/^jc-(\d{1,9})$/); if (m) { UI.route = 'jc'; UI.param = m[1]; return true; }
  m = h.match(/^new(?:-(\d{1,9}))?$/); if (m) { UI.route = 'new'; UI.param = m[1] || ''; return true; }
  m = h.match(/^jobs(?:-([poncx]|all))?$/); if (m) { UI.route = 'jobs'; UI.param = ''; if (m[1]) UI.tab = m[1]; return true; }
  if (['today', 'bookings', 'mechanics'].includes(h)) { UI.route = h; UI.param = ''; return true; }
  return false;
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

// ---------------- the frame: menu (read by the one screen), top bar, live chip ---------------------------------------------------
function nav() {
  const k = D && D.counts, open = k ? k.tabs.p + k.tabs.o : '', bk = k ? k.bk.pending : 0;
  const busy = D ? D.mstats.filter(m => m.now.length).length : 0;
  const items = [
    ['today', 'Today', 'dash', k ? String(k.made) : ''],
    ['jobs', 'Job cards', 'doc', k ? String(open) : ''],
    ['bookings', 'Online bookings', 'cal', k ? String(bk) : '', bk > 0],
    ['mechanics', 'Mechanics', 'wrench', D ? `${busy}/${D.mstats.length}` : ''],
  ];
  if (NJON) items.splice(1, 0, ['new', 'New job card', 'plus', '']);
  const a = UI.route === 'jc' ? 'jobs' : UI.route;
  return `<aside class="side ${UI.menu ? 'open' : ''}" id="side"><button class="brand" data-go="today">${logo('#FFFFFF')}<small>Service floor · Job cards</small></button>
 <nav class="navg" aria-label="Job cards"><h4>JOB CARDS</h4>${items.map(([r, l, i, b, hot]) => `<button class="nav ${a === r ? 'on' : ''}" data-go="${r}">${ic(i)}<span>${l}</span>${b !== '' ? `<span class="badge${hot ? ' blink' : ''}">${b}</span>` : ''}</button>`).join('')}</nav>
 <button class="me" data-act="logout" title="Sign out"><span class="avatar">${esc(initials(ME ? ME.name : ''))}</span><span><b>${esc(ME ? ME.name : '')}</b><span>Sign out</span></span></button></aside>`;
}
function chipTxt() {
  if (NET) return ['bad', 'Not connected', NET];
  if (!LINK) return ['', 'Connecting…', ''];
  if (!LINK.ok) return ['bad', 'Billing not reachable', LINK.err || ''];
  const s = LINK.at ? Math.max(0, Math.round((Date.now() - Date.parse(LINK.at)) / 1000)) : 0;
  return ['', `Live · ${s < 10 ? 'just now' : s < 90 ? s + ' s ago' : Math.round(s / 60) + ' min ago'}`, 'Read from the billing every few seconds'];
}
function chipHtml() { const [c, t, title] = chipTxt(); return `<span class="livechip ${c}" id="chip" title="${esc(title)}"><i></i><span>${esc(t)}</span></span>`; }
function chip() { const el = document.getElementById('chip'); if (el) el.outerHTML = chipHtml(); }
function top(title, sub, crumb, extra = '') {
  return `<div class="top"><div>${crumb ? `<button class="crumb" data-go="${crumb[0]}">‹ ${esc(crumb[1])}</button>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
 <div class="tools"><label class="sbox">${ic('search')}<input id="q" autocomplete="off" enterkeyhint="search" aria-label="Search job cards" placeholder="Vehicle no., name, phone or job card no." value="${esc(UI.q)}">${UI.q ? '<button type="button" data-act="clearq" aria-label="Clear the search">×</button>' : ''}</label>
 ${chipHtml()}${extra}${NJON ? (UI.route === 'new' ? '' : `<button class="btn pri" data-go="new">${ic('plus')}New job card</button>`)
    : `<a class="btn pri" href="${OLD}service-book.php" target="_blank" rel="noopener">${ic('plus')}New job card</a>`}</div></div>`;
}
const card = (h, body, sub = '', right = '') => `<section class="card"><div class="card-h"><h2>${h}${sub ? `<span class="sub">${sub}</span>` : ''}</h2>${right}</div>${body}</section>`;
function waiting(title) {
  const err = D0 && D0.link && D0.link.err;
  return top(esc(title), '') + (err ? `<div class="errbox"><b>The billing could not be read.</b> ${esc(err)}<br>The page tries again by itself every few seconds.</div>`
    : '<div class="card"><div class="empty">Reading the job cards from the billing…</div></div>');
}
function warnings() {
  const w = (D && D.link && D.link.warn) || [];
  if (!w.length) return '';
  const name = { mech: 'mechanics', bay: 'bays', adv: 'service advisors', bk: 'online bookings', inv: 'bills', si: 'bill links', pr: 'parts requests', pri: 'parts request items', cl: 'issue checklists', qc: 'QC', rem: 'service reminders', quo: 'quotations' };
  return `<div class="warnbox">This login of the billing cannot read: <b>${esc(w.map(k => name[k] || k).join(', '))}</b>. Everything else is up to date.</div>`;
}

// ---------------- Today ----------------------------------------------------------------------------------------------------------
function attention() {
  const out = [], recent = ymdOf(nowMs() - 2 * 864e5), cutBill = ymdOf(nowMs() - 3 * 864e5);
  for (const c of D.cards) {
    const fresh = c.at.slice(0, 10) >= recent;
    if ((c.tab === 'o' || c.tab === 'p') && c.pr && c.pr.wait) { const m = since(c.pr.at); out.push({ c, w: m > 15 ? 6 : 5, tone: m > 15 ? 'red' : 'orange', ico: 'box', t: `Spares asked ${dur(m)} ago, nobody attended`, s: `${plural(c.pr.n, 'part')} · ${c.mech || 'no mechanic'}` }); }
    else if ((c.tab === 'o' || c.tab === 'p') && c.pr && c.pr.chk) out.push({ c, w: 2, tone: 'blue', ico: 'box', t: `Stock being checked for ${plural(c.pr.chk, 'part')}`, s: `Asked ${when(c.pr.at)}` });
    if (c.tab === 'o' && c.due && fresh) { const m = since(c.due); if (m > 0) out.push({ c, w: 4, tone: 'red', ico: 'clock', t: `Past the expected delivery by ${dur(m)}`, s: `Expected ${when(c.due)} · ${c.mech || 'no mechanic'}` }); }
    if (c.tab === 'p' && fresh) { const m = since(c.at); if (m >= 60) out.push({ c, w: 3, tone: 'violet', ico: 'user', t: `Waiting for the customer's approval ${dur(m)}`, s: `Made ${when(c.at)} by ${c.by || '—'}` }); }
    if (c.tab === 'o' && !c.mid) out.push({ c, w: 3, tone: 'orange', ico: 'wrench', t: 'Ongoing without a mechanic', s: `Made ${when(c.at)} by ${c.by || '—'}` });
    if (completed(c) && !c.bill && (c.done || c.at).slice(0, 10) >= cutBill) out.push({ c, w: 1, tone: 'teal', ico: 'receipt', t: 'Completed, no bill yet', s: `Out ${when(c.done) || '—'} · ${c.mech || 'no mechanic'}` });
  }
  return out.sort((a, b) => b.w - a.w || b.c.id - a.c.id);
}
function pToday() {
  if (!D) return waiting('Today');
  const k = D.counts, me = D.me, now = nowMs(), d = new Date(ms(D.today));
  const h = new Date(now).getUTCHours(), hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = ME && ME.name ? ME.name.split(' ')[0] : '';
  const adv = Object.entries(k.byAdv).sort((a, b) => b[1] - a[1]);
  const made = D.cards.filter(c => c.td).sort((a, b) => b.id - a.id);
  const week = ymdOf(now - 6 * 864e5);
  const oldP = D.cards.filter(c => c.tab === 'p' && c.at.slice(0, 10) < week).length, oldO = D.cards.filter(c => c.tab === 'o' && c.at.slice(0, 10) < week).length;
  const kpi = (go, l, v, n, hot, data = '') => `<button class="kpi ${hot ? 'hot' : ''}" data-go="${go}" ${data}><span class="l">${l}</span><span class="v">${v}</span><span class="n">${n}</span></button>`;
  const kpis = `<div class="kpis k6">
  ${kpi('jobs', 'Job cards made today', k.made, me ? `You made <b>${k.mine}</b>` : adv.length ? adv.slice(0, 3).map(([n, x]) => `${esc(n.split(' ')[0])} <b>${x}</b>`).join(' · ') : 'None yet', false, 'data-tab="all" data-age="today"')}
  ${kpi('jobs', 'Pending approval', k.tabs.p, `<b>${k.todayTabs.p}</b> of today's · <b>${oldP}</b> older than 7 days`, false, 'data-tab="p" data-age=""')}
  ${kpi('jobs', 'Ongoing', k.tabs.o, `<b>${k.todayTabs.o}</b> of today's · <b>${oldO}</b> older than 7 days${k.paused ? ` · <b>${k.paused}</b> paused` : ''}`, false, 'data-tab="o" data-age=""')}
  ${kpi('jobs', 'Completed today', k.doneToday, `<b>${k.tabs.c}</b> in the Completed tab${k.naToday ? ` · <b>${k.naToday}</b> not approved today` : ''}`, false, 'data-tab="c" data-age=""')}
  ${kpi('bookings', 'Online bookings waiting', D.has.bk ? k.bk.pending : '—', D.has.bk ? `<b>${k.bk.today}</b> came today · <b>${k.bk.sched}</b> booked for today` : 'Bookings cannot be read', D.has.bk && k.bk.pending > 0)}
  <a class="kpi" href="${OLD}service-reminders.php" target="_blank" rel="noopener"><span class="l">Service reminders due</span><span class="v">${D.has.rem ? (me ? k.rem.mine : k.rem.all) : '—'}</span><span class="n">${me ? 'Calls due for you' : 'Calls due, all advisors'} · open in the service app ↗</span></a>
 </div>`;
  const att = attention(), attHtml = att.length ? `<div>${att.slice(0, 10).map(x => `<a class="att" href="#jc-${x.c.id}"><span class="ico p-${x.tone}">${ic(x.ico)}</span><span class="grow"><b>${esc(x.t)}</b><small>#${x.c.id} · ${esc(x.c.p || '—')} · ${esc(x.s)}</small></span>${ic('chev', 'i chev')}</a>`).join('')}</div>${att.length > 10 ? `<p class="note">And ${att.length - 10} more.</p>` : ''}`
    : '<div class="empty">Nothing needs attention right now.</div>';
  const stale = oldP + oldO ? `<p class="note"><b>${oldP}</b> pending and <b>${oldO}</b> ongoing job cards were made more than 7 days ago and are still open in the service app. <button class="link" data-go="jobs" data-tab="p" data-age="old">See the old pending ones</button></p>` : '';
  const bks = D.has.bk ? D.bookings.filter(b => b.f === 'pending').slice(0, 4) : [];
  const busy = D.mstats.filter(m => m.now.length).sort((a, b) => b.now.length - a.now.length || a.n.localeCompare(b.n));
  const side = card('Online bookings waiting', bks.length ? `<div>${bks.map(b => `<button class="att" data-go="bookings"><span class="ico p-orange">${ic('cal')}</span><span class="grow"><b>${esc(b.n || 'Customer')}</b><small>${esc([b.type, b.sched ? 'for ' + when(b.sched, false) : '', 'came ' + when(b.at)].filter(Boolean).join(' · '))}</small></span></button>`).join('')}</div>`
    : `<div class="empty">${D.has.bk ? 'No booking is waiting.' : 'The bookings cannot be read.'}</div>`, D.has.bk ? String(k.bk.pending) : '', '<button class="link" data-go="bookings">All bookings ›</button>')
    + card('Mechanics now', busy.length ? `<div>${busy.slice(0, 8).map(m => `<div class="att"><span class="ico p-blue">${esc(initials(m.n))}</span><span class="grow"><b>${esc(m.n)}</b><small>${m.now.map(j => esc(j.p || '#' + j.id)).slice(0, 3).join(', ')}${m.now.length > 3 ? ' …' : ''}</small></span>${pill(plural(m.now.length, 'job card'), 'blue')}</div>`).join('')}</div>`
      : '<div class="empty">No mechanic has an ongoing job card.</div>', `${busy.length} of ${D.mstats.length} busy`, '<button class="link" data-go="mechanics">All mechanics ›</button>');
  const chips = adv.length ? `<div class="chips">${adv.map(([n, x]) => `<span class="chip">${esc(n)} <i>${x}</i></span>`).join('')}</div>` : '';
  return top('Today', `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${first ? ` · ${hi}, ${esc(first)}` : ''}`) + warnings() + kpis
    + `<div class="grid g2">${card('Needs attention', attHtml + stale, att.length ? String(att.length) : '')}<div class="grid" style="align-content:start">${side}</div></div>`
    + card('Made today', (chips ? chips : '') + (made.length ? `<div class="jlist">${HEAD}${made.map(row).join('')}</div>` : '<div class="empty">No job card has been made today yet.</div>'), String(made.length), `<button class="link" data-go="jobs" data-tab="all" data-age="today">Open in Job cards ›</button>`);
}

// ---------------- Job cards ------------------------------------------------------------------------------------------------------
const TABS = [['p', 'Pending approval'], ['o', 'Ongoing'], ['c', 'Completed'], ['n', 'Not approved'], ['x', 'Other status'], ['all', 'All']];
function pJobs() {
  if (!D) return waiting('Job cards');
  // while another tab is asked, the counts stay; the rows of the old tab stay only while the search is typed
  const L = LIST && LIST.key === listKey() ? LIST : null, stale = LIST && !L && JSON.parse(LIST.key)[0] === UI.tab ? LIST : null, show = L || stale;
  const cnt = (LIST && LIST.counts) || D.counts.tabs, all = Object.values(cnt).reduce((a, n) => a + n, 0);
  const seg = `<div class="seg" role="tablist">${TABS.filter(([t]) => t !== 'x' || cnt.x || UI.tab === 'x').map(([t, l]) => `<button class="${UI.tab === t ? 'on' : ''}" data-act="tab" data-t="${t}" role="tab" aria-selected="${UI.tab === t}">${l}<b>${t === 'all' ? all : cnt[t] || 0}</b></button>`).join('')}</div>`;
  const ag = (L && L.ages) || null;
  const ages = `<div class="chips">${[['', 'Any day'], ['today', 'Made today'], ['week', 'Last 7 days'], ['old', 'Older']].map(([a, l]) => `<button class="chip ${UI.age === a ? 'on' : ''}" data-act="age" data-a="${a}">${l}${a && ag ? ` <i>${ag[a]}</i>` : ''}</button>`).join('')}
  ${D.me ? `<button class="chip ${UI.mine ? 'on' : ''}" data-act="mine">${ic('user')}Only mine</button>` : ''}</div>`;
  let body;
  if (!show) body = '<div class="empty">Loading the job cards…</div>';
  else if (show.err) body = `<div class="errbox">${esc(show.err)}</div>`;
  else if (!show.cards.length) body = `<div class="empty">${UI.q ? `No job card matches “${esc(UI.q.trim())}” here.` : 'No job card in this tab.'}</div>`;
  else body = `<div class="jlist">${HEAD}${show.cards.map(row).join('')}</div>${show.more ? `<div class="more"><button class="btn" data-act="more" ${BUSY ? 'disabled' : ''}>${BUSY ? 'Loading…' : `Show more (${show.total - show.cards.length} left)`}</button></div>` : ''}`;
  const note = show && !show.err ? `<p class="note">Showing <b>${show.cards.length}</b> of <b>${show.total}</b>${UI.q.trim() ? ` for “${esc(UI.q.trim())}”` : ''}${UI.mine ? ', made by you' : ''} · newest first${stale ? ' · updating…' : ''}</p>` : '';
  const xnote = UI.tab === 'x' ? '<div class="warnbox">These job cards have a status that the service app shows in none of its tabs, for example a status typed with a space or a line break, or "Work in progress", or approved but still pending. They are listed here so that the tabs add up to every job card of the billing.</div>' : '';
  const pnote = UI.tab === 'c' && cnt.c ? `<p class="note">Like the service app, this tab also has the paused job cards (a job of more than one day, “Paused” in the billing).</p>` : '';
  return top('Job cards', `All job cards of the billing, the same tabs as the service app · <b>${D.counts.all}</b> in all`) + warnings()
    + `<section class="card"><div class="bar2">${seg}</div><div class="bar2">${ages}</div>${xnote}${pnote}${note}${body}</section>`;
}

// ---------------- one job card ---------------------------------------------------------------------------------------------------
const PR_ST = { pending: ['Nobody attended yet', 'red'], seen: ['Seen', 'orange'], done: ['Done', 'green'], missed: ['Missed', 'gray'] };
const IT_ST = { in_stock: ['In stock', 'green'], pending: ['Pending', 'orange'], arranging: ['Arranging', 'orange'], checking: ['Checking', 'blue'], arranged: ['Arranged', 'green'] };
const pretty = s => String(s || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
function vrBlock(p) {
  const k = regKey(p), v = VR[k];
  if (!k) return '';
  if (v === undefined || v === null) return '<div class="vr"><span class="note">Looking for the saved VR Garage details…</span></div>';
  if (v.err !== undefined) return v.err === 400 ? '<div class="vr"><span class="note">This vehicle number is not a full number, so there are no VR Garage details.</span></div>' : '';
  const s = v.saved, d = (s && s.d) || {};
  const open = inShell ? `<button class="btn" data-act="gaadi" data-reg="${esc(k)}">${ic('bike')}Vehicle number page</button>` : '';
  const hist = (v.history || []).filter(h => h.jc !== JC.jc.id).slice(0, 6);
  const visits = hist.length ? `<div><span class="note">Other job cards of this vehicle</span><div class="tags" style="margin-top:6px">${hist.map(h => `<a class="chip" href="#jc-${+h.jc}">#${+h.jc} <i>${esc(h.date)}</i></a>`).join('')}</div></div>` : '';
  if (!s || s.found !== 1) return `<div class="vr"><div class="between"><b>VR Garage</b>${open}</div><span class="note">${s && s.found === 0 ? 'VR Garage has no details for this number.' : 'The VR Garage details of this vehicle are not saved yet.'}</span>${visits}</div>`;
  const kv = [['Owner', s.name || d.owner], ['Maker', d.maker], ['Model', s.model || d.model], ['Made in', d.mfg || d.year], ['Registered', d.regDate], ['Fuel', d.fuel], ['Colour', d.colour], ['CC', d.cc],
    ['Chassis no.', d.chassis], ['Engine no.', d.engine], ['Insurance up to', d.insUpto], ['PUC up to', d.pucUpto], ['RC status', d.status]].filter(x => x[1]);
  return `<div class="vr"><div class="between"><b>VR Garage</b>${open}</div><div class="kv">${kv.map(([a, b]) => `<div><span>${a}</span><b class="${/no\.$/.test(a) ? 'mono' : ''}">${esc(b)}</b></div>`).join('')}</div>
  <span class="note">Saved ${esc(when(istOf(s.at)) || '')}${s.by ? ` · asked by ${esc(s.by)}` : ''}</span>${visits}</div>`;
}
function pJc() {
  const id = +UI.param;
  if (JCERR) return top(`Job card #${id}`, '', ['jobs', 'Job cards']) + `<div class="errbox">${esc(JCERR)}</div>`;
  if (!JC || JC.jc.id !== id) return top(`Job card #${id}`, '', ['jobs', 'Job cards']) + '<div class="card"><div class="empty">Reading the job card from the billing…</div></div>';
  const j = JC.jc, [sl, sc] = stat(j), [lt, tone] = left(j), bill = JC.bills[0];
  const model = [j.mk, j.mo].filter(Boolean).join(' ');
  const approved = j.ap === 'APPROVED' || j.tab === 'o' || j.tab === 'c';
  const st = [
    ['Made', 'ok', when(j.at) + (j.by ? ` · ${j.by}` : '')],
    j.tab === 'n' ? ['Not approved', 'no', j.done ? when(j.done) : 'Customer said no'] : ['Approved', approved ? 'ok' : '', approved ? 'Customer said yes' : 'Waiting for the customer'],
    ['Mechanic', j.mech ? 'ok' : '', j.mech ? `${j.mech}${j.go ? ' · ' + when(j.go) : ''}` : 'Not assigned'],
    ['Work', completed(j) ? 'ok' : paused(j) ? 'pa' : '', completed(j) ? 'Done' : paused(j) ? 'Paused (more than one day)' : j.tab === 'o' ? `In work${j.go ? ' ' + dur(since(j.go)) : ''}` : '—'],
    ['Completed', completed(j) ? 'ok' : '', completed(j) ? when(j.done) || 'Yes' : 'Not yet'],
    ['Billed', bill ? 'ok' : '', bill ? `${bill.no}${bill.st ? ' · ' + pretty(bill.st.toLowerCase()) : ''}` : 'No bill yet'],
  ];
  const track = `<section class="card"><div class="track2">${st.map(([l, c, s], i) => `<div class="st2 ${c}"><span class="c">${c === 'ok' ? '✓' : c === 'no' ? '✕' : c === 'pa' ? 'II' : i + 1}</span><b>${esc(l)}</b><small>${esc(s)}</small></div>`).join('')}</div></section>`;
  const tile = (l, v, n, cls = '') => `<div class="kpi ${cls}"><span class="l">${l}</span><span class="v">${v}</span><span class="n">${n}</span></div>`;
  const tiles = `<div class="kpis">
  ${tile('Expected delivery', j.due ? esc(when(j.due)) : '—', `<span class="tone-${tone}">${esc(lt)}</span>`, `sm${j.tab === 'o' && tone === 'red' ? ' hot' : ''}`)}
  ${tile('Labour', inr(JC.labourTotal), plural(JC.labour.length, 'line'))}
  ${tile('Parts on the bill', JC.parts ? inr(JC.partsTotal) : '—', JC.parts ? (JC.parts.length ? `${plural(JC.parts.length, 'part')} · latest bill` : 'No parts billed yet') : 'Cannot be read')}
  ${tile('Estimate', j.est ? inr(j.est) : '—', j.pe ? `Parts estimate ${inr(j.pe)}` : j.tab === 'n' ? 'Zero bill' : 'Given at the job card')}
 </div>`;
  const kv = [['Customer', esc(j.n || '—')], ['Phone', j.ph ? `<a href="tel:${esc(tel(j.ph))}" class="mono">${esc(j.ph)}</a>` : '—'], ['Vehicle number', `<span class="mono">${esc(j.p || '—')}</span>`],
    ['Make and model', esc(model || '—')], ['KM reading', esc(j.km ? j.km + ' km' : '—')], ['Daily km (average)', esc(j.avg || '—')], ['Fuel', esc(j.fl || j.fuel || '—')],
    ['Last service', esc(when(j.last, false) || j.last || '—')], ['Package', esc(j.pkg || '—')], ['Free service claim', j.free ? 'Yes' : 'No'], ['Slot', esc(j.slot || '—')],
    ['Bay', esc(j.bay || '—')], ['Mechanic', esc(j.mech || 'Not assigned')], ['Advisor', esc(j.by || '—')], ['Vehicle in', esc(when(j.at) || '—')],
    ['Service started', esc(when(j.go) || '—')], ['Vehicle out', esc(when(j.done) || '—')]];
  const cust = card('Customer and vehicle', `<div class="kv">${kv.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>${vrBlock(j.p)}`);
  const gs = JC.gs.filter(x => x[1]);
  const pts = JC.points ? Object.entries(JC.points).sort((a, b) => b[1] - a[1]) : [];
  const comp = card('Complaint and service', `${j.svc ? `<div><span class="note">Service</span><div class="pre">${esc(j.svc)}</div></div>` : ''}${j.issue ? `<div><span class="note">What the customer said</span><div class="pre">${esc(j.issue)}</div></div>` : ''}
  ${gs.length ? `<div><span class="note">General service items</span><div class="tags" style="margin-top:6px">${gs.map(x => pill(x[0] + (x[2] ? ': ' + x[2] : ''), 'yel')).join('')}</div></div>` : ''}
  ${pts.length ? `<div><span class="note">Inspection points (mechanic's app)</span><div class="tags" style="margin-top:6px">${pts.map(([s, n]) => pill(`${pretty(s)} ${n}`, /^(ok|good|done|checked)$/i.test(s) ? 'green' : /not_checked/i.test(s) ? 'gray' : 'orange')).join('')}</div></div>` : ''}
  ${!j.svc && !j.issue && !gs.length && !pts.length ? '<div class="empty">Nothing written.</div>' : ''}`);
  const lab = card('Labour', JC.labour.length ? `<table class="lines"><thead><tr><th>Labour</th><th>Type</th><th class="r">Amount</th></tr></thead><tbody>${JC.labour.map(x => `<tr><td>${esc(x.n)}</td><td>${esc([x.cc, x.cu ? 'custom' : ''].filter(Boolean).join(' · ') || '—')}</td><td class="r">${inr(x.a)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total</td><td class="r">${inr(JC.labourTotal)}</td></tr></tfoot></table>`
    : '<div class="empty">No labour line yet.</div>', String(JC.labour.length || ''));
  const parts = JC.parts === null ? card('Parts on the bill', '<div class="empty">The bill lines cannot be read by this login.</div>')
    : card('Parts on the bill', JC.parts.length ? `<table class="lines"><thead><tr><th>Part</th><th>Brand</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>${JC.parts.map(x => `<tr><td>${esc(x.n)}<br><small class="muted mono">${esc(x.pn)}</small></td><td>${esc(x.br)}</td><td class="r">${esc(x.q)}</td><td class="r">${inr(x.a)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Total (after the line discount)</td><td class="r">${inr(JC.partsTotal)}</td></tr></tfoot></table>`
      : '<div class="empty">No part is on a bill of this job card yet.</div>', JC.parts.length ? 'latest bill' : '');
  const reqs = JC.requests === null ? '' : JC.requests.length ? card('Parts requests', JC.requests.map(r => {
    const [t, c] = PR_ST[r.st] || [pretty(r.st) || 'No status', 'gray'];
    const its = r.items.length ? `<div>${r.items.map(i => { const [a, b] = IT_ST[i.st] || [pretty(i.st), 'gray']; return `<div class="chk"><span class="c">${ic('box')}</span><span class="grow"><b>${esc(i.n)}</b>${i.lbl || i.until ? `<br><small class="muted">${esc([i.lbl, i.until ? 'until ' + when(i.until) : ''].filter(Boolean).join(' · '))}</small>` : ''}</span>${pill(a, b)}</div>`; }).join('')}</div>`
      : r.names.length ? `<div class="tags">${r.names.map(n => pill(n, 'gray')).join('')}</div>` : '';
    return `<div class="vr"><div class="between"><b>Asked ${esc(when(r.at) || '—')}</b>${pill(t, c)}</div>${r.att || r.by ? `<span class="note">Attended ${esc(when(r.att) || '')}${r.by ? ' by ' + esc(r.by) : ''}</span>` : ''}${its}</div>`;
  }).join(''), String(JC.requests.length)) : '';
  const bills = card('Bills', JC.bills.length ? `<div>${JC.bills.map(b => `<div class="chk"><span class="c">${ic('receipt')}</span><span class="grow"><b class="mono">${esc(b.no || '—')}</b><br><small class="muted">${esc([b.d, b.t].filter(Boolean).join(' '))}${b.by ? ' · ' + esc(b.by) : ''}</small></span>${b.st === 'PAID' ? pill('Paid', 'green') : b.st === 'CREDIT' ? pill('Credit', 'orange') : pill(b.st ? pretty(b.st.toLowerCase()) : 'Not paid', 'orange')}</div>`).join('')}</div>`
    : `<div class="empty">${j.tab === 'n' ? 'Zero bill: the customer did not approve.' : 'No bill yet.'}</div>`);
  const chk = JC.checklist && JC.checklist.length ? card('Issue checklist', `<div>${JC.checklist.map(x => `<div class="chk ${x.st === 'done' ? 'done' : x.st === 'not_done' ? 'nd' : ''}"><span class="c">${x.st === 'done' ? '✓' : x.st === 'not_done' ? '✕' : ''}</span><span class="grow"><b>${esc(x.item)}</b>${x.why ? `<br><small class="muted">${esc(x.why)}</small>` : ''}</span><small class="muted">${esc(x.st === 'done' ? 'Done' : x.st === 'not_done' ? 'Not done' : 'Pending')}</small></div>`).join('')}</div>`,
    `${JC.checklist.filter(x => x.st === 'done').length} of ${JC.checklist.length} done`) : '';
  const qc = JC.qc && JC.qc.length ? card('Quality check', `<div>${JC.qc.map(q => `<div class="chk ${q.st === 'passed' || q.st === 'pass' || q.st === 'ok' ? 'done' : q.st === 'rework' || q.st === 'fail' || q.st === 'failed' ? 'nd' : ''}"><span class="c">${q.lv}</span><span class="grow"><b>Level ${q.lv} · ${esc(pretty(q.st) || '—')}</b><br><small class="muted">${esc([q.by, when(q.at)].filter(Boolean).join(' · '))}${q.notes ? ' · ' + esc(q.notes) : ''}</small></span></div>`).join('')}</div>`) : '';
  const quo = JC.quotes.length ? card('Quotations of this vehicle', `<div>${JC.quotes.map(q => `<div class="chk"><span class="c">${ic('doc')}</span><span class="grow"><b>Quotation #${q.id}</b><br><small class="muted">${esc(when(q.at) || '—')}</small></span>${q.st ? pill(pretty(q.st.toLowerCase()), 'gray') : ''}</div>`).join('')}</div>`) : '';
  // a job card that stopped before its photos (made here or in the service app) goes on in New job card
  const cont = NJON && j.ap === 'PENDING' && ['', 'PENDING'].includes(j.st) && !j.km;
  const extra = (cont ? `<button class="btn pri" data-go="new" data-param="${j.id}">${ic('doc')}Continue job card</button>` : '')
    + `<a class="btn" href="${OLD}job-card-labour.php?id=${j.id}" target="_blank" rel="noopener">${ic('ext')}Open in the service app</a>`;
  return top(`Job card #${j.id} ${pill(sl, sc)}`, `<span class="mono">${esc(j.p || '—')}</span>${model ? ' · ' + esc(model) : ''} · made ${esc(when(j.at) || '—')}${j.by ? ' by ' + esc(j.by) : ''}`, ['jobs', 'Job cards'], extra)
    + track + tiles + `<div class="grid g2"><div class="grid" style="align-content:start">${comp}${lab}${parts}${reqs}</div><div class="grid" style="align-content:start">${cust}${bills}${qc}${chk}${quo}</div></div>`;
}

// ---------------- Online bookings ------------------------------------------------------------------------------------------------
const BK = [['pending', 'Waiting', 'orange'], ['confirmed', 'Confirmed', 'blue'], ['converted', 'Job card made', 'green'], ['cancelled', 'Cancelled', 'gray'], ['all', 'All', '']];
function pBookings() {
  if (!D) return waiting('Online bookings');
  const k = D.counts.bk, extra = `<a class="btn" href="${OLD}online-bookings.php" target="_blank" rel="noopener">${ic('ext')}Confirm in the service app</a>`;
  if (!D.has.bk) return top('Online bookings', '', null, extra) + '<div class="warnbox">This login of the billing cannot read the online bookings.</div>';
  const seg = `<div class="seg">${BK.map(([f, l]) => `<button class="${UI.bk === f ? 'on' : ''}" data-act="bk" data-f="${f}">${l}<b>${f === 'all' ? k.all : k[f] || 0}</b></button>`).join('')}</div>`;
  const list = D.bookings.filter(b => UI.bk === 'all' || b.f === UI.bk);
  const rowB = (a, b) => b ? `<div class="row2"><span>${a}</span><span>${b}</span></div>` : '';
  const cards = list.map(b => {
    const [, l, c] = BK.find(x => x[0] === b.f) || [0, 'No status', 'gray'];
    return `<div class="bk"><div class="between"><b>${esc(b.n || 'Customer')}</b>${pill(l, c)}</div>
   ${b.ph ? `<a class="mono" href="tel:${esc(tel(b.ph))}">${esc(b.ph)}</a>` : ''}
   ${rowB('Service', esc(b.type))}${rowB('Pick up', esc(pretty(b.pick)))}${rowB('Bike', esc(b.bike))}${rowB('Booked for', esc(when(b.sched, false)))}
   ${rowB('Came', esc(when(b.at)))}${rowB('Address', esc(b.addr))}${rowB('Attended by', b.ab ? esc(b.ab + (b.aat ? ' · ' + when(b.aat) : '')) : '')}
   ${b.note ? `<div class="pre">${esc(b.note)}</div>` : ''}
   ${b.lat !== undefined ? `<a class="btn" href="https://www.google.com/maps?q=${+b.lat},${+b.lng}" target="_blank" rel="noopener">${ic('map')}Open the location in Maps</a>` : ''}</div>`;
  }).join('');
  return top('Online bookings', `<b>${k.today}</b> came today · <b>${k.sched}</b> booked for today · from the customer app and the website`, null, extra)
    + `<section class="card"><div class="bar2">${seg}</div>${D.bookings.length < k.all ? `<p class="note">The newest ${D.bookings.length} bookings are shown.</p>` : ''}${list.length ? `<div class="bgrid">${cards}</div>` : '<div class="empty">No booking here.</div>'}</section>`;
}

// ---------------- Mechanics ------------------------------------------------------------------------------------------------------
function pMechanics() {
  if (!D) return waiting('Mechanics');
  const all = [...D.mstats].sort((a, b) => b.now.length - a.now.length || a.n.localeCompare(b.n));
  const busy = all.filter(m => m.now.length).length;
  const stp = s => s === 'BUSY' ? pill('Busy', 'orange') : s === 'ACTIVE' ? pill('Free', 'green') : pill(pretty(String(s).toLowerCase()) || 'No status', 'gray');
  const cards = all.map(m => `<div class="mc"><div class="between"><div class="row"><span class="avatar p-yel">${esc(initials(m.n))}</span><b>${esc(m.n)}</b></div>${stp(m.st)}</div>
   <div class="note">Now <b>${m.now.length}</b> · completed today <b>${m.today}</b> · this month <b>${m.month}</b>${m.paused ? ` · paused <b>${m.paused}</b>` : ''}</div>
   ${m.now.length ? m.now.sort((a, b) => b.id - a.id).slice(0, 6).map(j => { const l = left({ ...j, tab: 'o' }); return `<a class="jb" href="#jc-${j.id}"><span><b class="mono">${esc(j.p || '—')}</b><br><small class="muted">#${j.id}${j.mo ? ' · ' + esc(j.mo) : ''}${j.bay ? ' · ' + esc(j.bay) : ''}</small></span><small class="tone-${l[1]}" style="text-align:right">${esc(l[0])}</small></a>`; }).join('') + (m.now.length > 6 ? `<span class="note">And ${m.now.length - 6} older ongoing job cards.</span>` : '') : '<span class="note">No ongoing job card.</span>'}</div>`).join('');
  return top('Mechanics', `<b>${busy}</b> of <b>${all.length}</b> have an ongoing job card · status as the billing has it`) + `<div class="mgrid">${cards}</div>`;
}

// ---------------- sign in (only when opened by itself, outside the one screen) ---------------------------------------------------
function pLogin() {
  return `<div class="login"><div class="box"><div class="logo">${logo('var(--char)')}</div>
 <form class="card" data-form="login" style="width:100%;padding:36px;gap:22px"><div class="cell2" style="gap:6px"><h1 style="font-size:28px;font-weight:800">Job cards</h1><span class="muted">Sign in to see the job cards of the workshop.</span></div>
 <label class="field" for="lp">Phone number<input class="inp mono" id="lp" inputmode="tel" autocomplete="username" style="padding:13px 14px;font-weight:600"></label>
 <div class="field">4-digit PIN<div class="pins">${[0, 1, 2, 3].map(i => `<input id="pin${i}" maxlength="1" inputmode="numeric" aria-label="PIN digit ${i + 1}" autocomplete="off">`).join('')}</div></div>
 <div id="loginErr" class="muted" hidden style="color:var(--redT);font-weight:700"></div>
 <button class="btn pri" type="submit" style="padding:14px;font-size:15px">Sign in</button></form></div></div>`;
}

// ---------------- drawing and events ---------------------------------------------------------------------------------------------
const ROUTES = { today: pToday, jobs: pJobs, jc: pJc, bookings: pBookings, mechanics: pMechanics };
const root = document.getElementById('root');
function render() {
  const a = document.activeElement, fid = a && a.id, pos = fid && a.selectionStart;
  if (!UI.ready) { root.innerHTML = ''; return; }
  if (!UI.authed) { root.innerHTML = pLogin(); const p = document.getElementById('lp'); if (p) p.focus(); return; }
  const page = (ROUTES[UI.route] || pToday)();
  root.innerHTML = `<div class="mobilebar">${logo('#FFFFFF', 'logo')}<div class="row"><button data-act="menu" aria-label="Menu">${ic('menu')}</button></div></div><div class="app">${nav()}<main class="main">${page}</main></div>`;
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch { /* not a text box */ } } }
}
let qT = 0;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { UI.q = t.value.slice(0, 40); clearTimeout(qT); if (UI.route === 'jobs') qT = setTimeout(() => loadList(), 220); }
  if (/^pin\d$/.test(t.id)) { t.value = t.value.replace(/\D/g, '').slice(0, 1); const i = +t.id[3]; if (t.value && i < 3) document.getElementById('pin' + (i + 1)).focus(); if (t.value && i === 3) document.querySelector('[data-form="login"]').requestSubmit(); }
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'q' && e.key === 'Enter') { e.preventDefault(); if (UI.route !== 'jobs') { if (UI.q.trim()) UI.tab = 'all'; UI.age = ''; go('jobs'); } else loadList(); }
  if (e.key === 'Escape' && UI.menu) { UI.menu = false; render(); }
  if (/^pin\d$/.test(e.target.id) && e.key === 'Backspace' && !e.target.value) { const i = +e.target.id[3]; if (i > 0) document.getElementById('pin' + (i - 1)).focus(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.dataset.form !== 'login') return;
  const pin = [0, 1, 2, 3].map(i => document.getElementById('pin' + i).value).join(''), err = document.getElementById('loginErr');
  if (pin.length < 4) { err.textContent = 'Enter all 4 digits of the PIN.'; err.hidden = false; return; }
  api('POST', '/auth/login', { phone: document.getElementById('lp').value, pin }).then(() => load()).catch(x => {
    err.textContent = x.message; err.hidden = false; [0, 1, 2, 3].forEach(i => { document.getElementById('pin' + i).value = ''; }); document.getElementById('pin0').focus();
  });
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-go]');
  if (!t) { if (UI.menu && !e.target.closest('#side')) { UI.menu = false; render(); } return; }
  const a = t.dataset.act;
  if (t.dataset.go && !a) {
    if (t.dataset.tab !== undefined) UI.tab = t.dataset.tab;
    if (t.dataset.age !== undefined) UI.age = t.dataset.age;
    go(t.dataset.go, t.dataset.param || ''); return;
  }
  switch (a) {
    case 'menu': UI.menu = !UI.menu; render(); break;
    case 'logout': api('POST', '/auth/logout').catch(() => {}); UI.authed = false; D = null; LIST = null; JC = null; render(); break;
    case 'tab': UI.tab = t.dataset.t; render(); loadList(); break;
    case 'age': UI.age = t.dataset.a; render(); loadList(); break;
    case 'mine': UI.mine = !UI.mine; render(); loadList(); break;
    case 'more': more(); break;
    case 'bk': UI.bk = t.dataset.f; render(); break;
    case 'clearq': UI.q = ''; render(); if (UI.route === 'jobs') loadList(); { const q = document.getElementById('q'); if (q) q.focus(); } break;
    case 'gaadi': try { window.top.postMessage({ bsGaadi: t.dataset.reg }, location.origin); } catch { /* not in the one screen */ } break;
  }
});
window.addEventListener('hashchange', () => { if (fromHash()) { UI.menu = false; render(); window.scrollTo(0, 0); routeLoad(); } });
// the one screen asks for a page of this panel
window.addEventListener('message', e => { if (e.origin === location.origin && e.data && typeof e.data.bsGo === 'string' && ROUTES[e.data.bsGo]) go(e.data.bsGo); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
// for newjc.js (New job card): the frame and the helpers of this page
window.BSF = { api, esc, ic, pill, inr, toast, go, render: () => render(), top, card, routes: ROUTES, ui: UI, me: () => ME, jcOn: () => NJON, inShell };
fromHash();
load();
setInterval(poll, 3000);
setInterval(chip, 5000);
// the times left change by themselves: draw again each minute
setInterval(() => { if (UI.authed && D && UI.route !== 'new') render(); }, 60000);
})();
