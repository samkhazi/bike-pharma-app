// Bike Surgeon Inventory (parts, Moto Lab items, vendors, stock in, transfers, rack checks). Started by boot.js with the signed-in user and the data from the server.
// Every change goes to the API (server/routes.js) and the fresh data comes back.
window.startInv=function(BOOT){
const LOGO_PATH="M392.8 91.6C392.1 91.4 392.0 90.9 392.0 86.3L392.0 82.0L392.4 81.6L392.8 81.2L403.0 81.2C415.2 81.1 416.3 81.1 417.4 80.4C419.0 79.4 419.6 77.7 419.6 74.1C419.6 72.0 419.6 72.0 419.1 71.5L418.7 71.1L410.0 71.0C402.5 70.9 401.1 70.8 400.3 70.6C399.8 70.5 398.9 70.2 398.3 70.1C397.6 69.9 396.9 69.7 396.5 69.5C396.2 69.3 395.7 69.2 395.3 69.1C394.1 68.8 391.0 66.9 389.2 65.3C388.0 64.2 387.4 63.2 386.1 60.8C385.5 59.7 384.8 58.3 384.5 57.8C384.2 57.1 384.0 56.6 384.0 56.1C384.0 55.6 383.8 54.9 383.6 54.3C383.2 53.3 383.1 53.0 383.0 49.7C382.8 44.4 383.0 39.6 383.5 38.6C383.7 38.1 383.9 37.3 384.0 36.8C384.1 36.2 384.4 35.4 384.6 35.0C384.8 34.5 385.0 34.1 385.0 34.0C385.0 33.6 386.1 31.4 386.8 30.4C388.7 28.0 391.2 25.8 393.8 24.7C394.6 24.3 395.4 24.0 395.4 24.0C395.5 24.0 396.0 23.8 396.5 23.6C397.0 23.3 397.9 23.1 398.5 23.0C399.1 22.9 399.9 22.7 400.4 22.6C402.4 22.0 404.4 22.0 418.4 22.0L432.2 22.1L432.5 22.5L432.9 22.8L433.0 50.3L433.0 77.7L432.5 79.2C432.2 80.0 432.0 80.9 432.0 81.2C432.0 82.1 430.7 84.4 429.5 85.8C428.1 87.4 426.7 88.4 424.7 89.4C423.8 89.8 422.8 90.4 422.5 90.5C421.7 90.9 419.8 91.3 417.2 91.5C414.9 91.7 393.3 91.8 392.8 91.6ZM517.8 71.4C517.0 71.3 515.4 71.1 514.3 71.0C512.9 70.9 512.2 70.8 511.7 70.5C511.3 70.3 510.7 70.1 510.2 70.0C507.1 69.3 501.6 65.4 500.0 62.7C499.5 61.9 499.0 61.1 498.9 60.8C498.8 60.6 498.7 60.2 498.5 60.0C498.0 59.3 497.0 57.3 497.0 57.0C497.0 56.9 496.8 56.3 496.5 55.7C495.8 54.1 495.8 52.8 496.4 52.3C496.9 52.0 497.1 52.0 501.4 52.0C506.9 52.0 506.7 51.9 508.2 54.6C508.8 55.8 510.9 57.9 512.5 58.9C514.8 60.5 519.6 62.0 521.7 61.8C523.3 61.6 526.2 60.9 527.7 60.3C531.7 58.6 535.9 54.0 534.3 53.2C534.0 53.0 532.0 53.0 527.2 53.0C519.2 53.0 519.8 53.1 518.6 51.1C517.2 48.6 516.3 46.8 516.3 46.1C516.3 45.5 516.9 44.2 518.1 42.5C518.4 42.0 518.8 41.3 519.0 40.9C519.6 39.8 519.7 39.8 527.0 39.9C534.4 39.9 534.5 39.9 534.5 38.6C534.5 37.8 533.1 36.0 531.4 34.7C530.7 34.1 529.7 33.2 529.2 32.7C528.0 31.7 527.2 31.2 525.9 31.0C525.4 30.9 524.5 30.7 523.9 30.5C522.4 30.0 519.8 30.0 518.1 30.6C517.4 30.8 516.7 31.0 516.6 31.0C515.1 31.0 509.8 35.2 508.5 37.4C507.7 38.9 506.5 40.3 506.1 40.5C505.8 40.6 504.2 40.7 501.2 40.7L496.8 40.7L496.4 40.3C495.9 39.7 495.9 38.7 496.4 37.5C496.7 37.0 497.0 36.2 497.1 35.8C497.7 33.6 499.5 30.5 501.4 28.4C503.5 26.0 509.7 22.5 512.8 22.1C513.2 22.0 514.1 21.8 514.7 21.7C517.7 20.8 524.1 20.8 528.0 21.7C528.8 21.8 529.8 22.0 530.2 22.1C533.5 22.9 538.0 25.3 540.3 27.5C543.0 30.2 543.9 31.5 545.0 34.6C545.2 35.0 545.4 35.7 545.6 36.1C545.9 36.5 546.0 37.0 546.0 37.6C546.0 38.1 546.2 38.8 546.5 39.5L547.0 40.7L547.1 46.7L547.1 52.6L546.6 53.8C546.3 54.4 546.0 55.3 545.9 55.8C545.8 56.6 545.5 57.4 543.5 60.9C542.5 62.8 542.1 63.3 541.0 64.4C539.3 66.0 537.2 67.6 536.4 67.9C536.0 68.0 535.3 68.3 534.9 68.6C534.4 68.8 534.0 69.0 533.9 69.0C533.8 69.0 533.3 69.2 533.0 69.3C531.7 70.0 528.4 71.0 527.5 71.0C527.0 71.0 525.7 71.1 524.8 71.3C522.6 71.7 520.2 71.7 517.8 71.4ZM2.8 70.7C2.5 70.6 2.3 70.3 2.2 69.9C2.0 69.1 1.9 5.8 2.2 4.7C2.2 4.3 2.5 3.8 2.7 3.5L3.2 3.1L25.5 3.1L47.8 3.1L48.9 3.5C51.7 4.4 55.7 6.6 57.2 8.1C58.5 9.4 60.2 11.8 61.1 13.8C61.8 15.3 61.9 15.5 62.1 17.7C62.6 24.2 62.2 26.3 59.6 30.4C59.1 31.2 58.5 32.2 58.2 32.7C57.5 33.9 56.7 34.7 55.1 35.7C53.8 36.5 53.8 36.6 53.8 37.2C53.8 37.7 53.9 37.8 55.2 38.9C58.6 41.4 60.4 43.5 60.9 45.5C61.1 46.0 61.3 46.8 61.6 47.4C62.5 49.8 62.4 57.6 61.4 59.7C61.2 60.2 61.0 60.8 61.0 61.1C61.0 61.7 60.2 63.2 59.2 64.7C58.2 66.3 55.5 68.3 53.6 69.0C53.1 69.2 52.5 69.4 52.2 69.6C51.8 69.8 51.0 69.9 50.3 70.0C49.6 70.1 48.5 70.3 47.9 70.5L46.8 70.9L25.0 71.0C6.0 71.0 3.2 71.0 2.8 70.7ZM73.9 70.8C73.0 70.5 73.0 71.7 73.0 46.6C73.0 30.2 73.1 23.4 73.2 23.0C73.5 22.0 73.8 22.0 79.7 21.9C86.1 21.8 86.1 21.8 86.5 23.5C86.7 24.4 86.7 69.9 86.5 70.3C86.4 70.5 86.1 70.7 85.8 70.8C85.2 71.0 74.4 71.1 73.9 70.8ZM101.2 70.8C100.2 70.4 100.3 73.0 100.3 36.9C100.3 16.8 100.4 3.8 100.5 3.7C100.8 3.1 101.6 3.0 107.1 3.0C113.0 3.0 113.2 3.0 113.6 3.9C113.8 4.2 113.9 7.8 113.9 21.9C113.9 40.4 113.9 40.2 114.7 40.2C114.8 40.2 115.5 39.6 116.3 38.7C117.0 37.9 118.2 36.7 118.9 36.0C119.6 35.3 120.8 33.9 121.6 32.9C123.5 30.6 131.4 22.4 132.2 22.1C133.1 21.7 145.3 21.8 145.5 22.2C145.8 22.7 145.5 23.0 141.0 27.5C138.5 30.0 136.2 32.4 135.9 32.8C135.7 33.1 134.2 34.8 132.5 36.4C129.1 39.8 128.8 40.1 129.3 40.7C129.6 41.0 129.8 41.1 131.3 41.1C136.5 41.2 141.4 43.7 142.0 46.5C142.1 47.0 142.3 47.7 142.5 48.0C142.7 48.4 142.9 49.3 143.0 49.9C143.1 50.6 143.3 51.5 143.5 51.9L143.9 52.8L144.0 61.5L144.0 70.2L143.6 70.6L143.2 71.0L137.5 71.0L131.8 71.0L131.4 70.6L131.0 70.2L131.0 64.4C131.0 58.3 130.9 57.4 130.2 55.3C129.2 52.1 127.9 51.7 119.4 51.7L114.8 51.7L114.3 52.1L113.9 52.6L113.9 61.3L113.9 70.0L113.5 70.5L113.0 70.9L107.3 71.0C104.2 71.0 101.4 70.9 101.2 70.8ZM173.3 70.8C172.9 70.8 172.1 70.5 171.4 70.4C170.8 70.2 169.9 70.0 169.5 70.0C168.9 70.0 168.2 69.8 167.3 69.4C166.5 69.1 165.5 68.6 165.0 68.4C164.5 68.2 163.9 68.0 163.7 67.9C163.0 67.7 161.5 66.8 160.5 66.0C160.0 65.6 159.3 65.0 158.9 64.8C158.2 64.3 156.8 62.4 156.0 60.9C155.9 60.6 155.3 59.5 154.9 58.6C154.4 57.7 154.0 56.8 154.0 56.6C154.0 56.4 153.8 55.8 153.6 55.3C153.2 54.6 153.1 54.0 153.0 52.5C152.9 51.4 152.7 49.9 152.6 49.0C152.3 46.9 152.3 45.6 152.7 43.1C152.8 41.9 153.0 40.5 153.0 39.9C153.0 39.2 153.1 38.7 153.5 37.9C153.8 37.4 154.0 36.7 154.0 36.5C154.0 36.3 154.2 35.7 154.4 35.2C154.6 34.8 154.9 34.0 155.1 33.6C156.1 30.1 160.9 25.4 165.0 23.9C170.1 22.0 169.9 22.0 183.8 22.0L195.2 22.1L195.5 22.5C195.9 22.8 195.9 23.0 196.0 26.5C196.0 30.5 196.0 30.7 195.4 31.3L195.0 31.7L185.3 31.7C172.5 31.7 172.9 31.6 170.2 34.1C168.6 35.6 168.2 36.2 167.9 38.0C167.5 39.7 167.6 40.4 168.2 40.8C168.3 40.9 174.4 41.0 181.7 41.0L195.0 41.1L195.5 41.5L195.9 42.0L195.9 46.4C195.9 50.6 195.9 50.7 195.6 51.0C195.0 51.4 191.3 51.5 178.9 51.5L168.3 51.4L167.8 51.9C167.1 52.6 167.1 53.1 167.6 54.4C167.8 55.1 168.0 55.8 168.1 56.1C168.1 56.3 168.7 57.0 169.3 57.7C170.6 59.1 171.9 59.8 173.7 60.0C174.4 60.1 175.4 60.2 176.0 60.3C176.6 60.4 181.1 60.5 186.1 60.6L195.1 60.7L195.5 61.2L196.0 61.6L196.0 65.7C196.0 70.1 195.9 70.5 195.2 70.8C194.8 71.0 174.6 71.0 173.3 70.8ZM208.4 70.6C207.8 70.1 207.7 69.0 207.7 64.4C207.7 60.2 207.8 59.6 208.7 59.2C209.0 59.1 213.1 59.0 226.4 59.0C235.9 59.0 244.0 58.9 244.3 58.9C248.4 57.9 250.3 56.7 251.5 54.6C251.9 53.8 251.9 53.6 251.9 51.4C251.9 49.2 251.9 49.0 251.4 47.5C250.4 44.9 248.6 43.4 245.9 42.9C245.2 42.8 244.1 42.6 243.4 42.4C242.4 42.2 240.8 42.1 231.4 42.0L220.6 41.9L219.3 41.4C218.6 41.2 217.7 41.0 217.5 41.0C217.2 41.0 216.5 40.8 216.1 40.6C215.6 40.4 214.8 40.1 214.3 39.9C213.1 39.6 210.7 38.0 209.1 36.4C207.7 35.1 206.6 33.2 206.0 31.4C205.9 31.1 205.6 30.4 205.4 29.9C205.2 29.5 205.0 28.8 205.0 28.6C205.0 28.3 204.8 27.6 204.7 27.0C204.1 25.2 204.0 22.8 204.6 20.6C204.8 19.7 205.0 18.4 205.0 17.8C205.0 17.0 205.1 16.5 205.4 15.9C205.6 15.4 205.9 14.7 206.0 14.4C206.2 13.7 208.3 10.4 209.3 9.3C211.2 7.1 213.0 5.9 215.8 4.9C216.4 4.7 217.5 4.3 218.2 3.9C220.1 3.0 220.6 3.0 243.7 3.0L263.2 3.0L263.6 3.4L264.0 3.8L264.0 8.9C263.9 13.9 263.9 14.0 263.6 14.4L263.2 14.7L245.4 14.7C226.0 14.8 224.7 14.8 223.4 15.6C222.2 16.3 221.2 17.4 221.0 18.1C220.9 18.5 220.6 19.2 220.4 19.7C220.0 20.5 220.0 20.8 220.0 22.7C220.0 24.7 220.0 24.8 220.6 26.0C221.4 27.5 222.1 28.3 223.7 29.2L224.9 29.9L227.2 30.0C228.5 30.1 233.9 30.2 239.2 30.2C247.1 30.3 249.0 30.4 250.0 30.6C250.7 30.7 252.1 30.9 253.2 31.0C256.1 31.3 256.8 31.7 262.5 36.3C264.0 37.5 266.0 40.1 266.0 40.8C266.0 41.0 266.2 41.5 266.4 42.0C266.7 42.5 267.0 43.5 267.1 44.2C267.2 44.9 267.5 45.8 267.6 46.3C268.1 47.9 268.0 54.0 267.5 55.1C267.3 55.5 267.1 56.4 267.0 56.9C266.9 57.5 266.7 58.3 266.4 58.8C266.2 59.3 266.0 59.7 266.0 59.8C266.0 60.9 263.3 65.2 261.8 66.6C260.2 68.0 256.3 69.8 254.6 70.0C253.8 70.1 252.7 70.3 252.0 70.5L250.8 70.9L229.8 71.0L208.9 71.0L208.4 70.6ZM292.6 70.8C292.0 70.8 291.1 70.6 290.5 70.4C290.0 70.2 289.2 70.0 288.8 70.0C288.1 70.0 287.4 69.7 284.5 68.3C281.9 67.0 279.0 63.3 279.0 61.2C279.0 60.9 278.8 60.1 278.5 59.6L278.1 58.6L278.0 40.6L278.0 22.7L278.4 22.3C278.9 22.0 279.1 22.0 284.3 22.0C290.1 22.0 290.5 22.0 290.8 22.8C290.9 23.1 291.0 27.8 291.0 39.0L291.0 54.9L291.4 56.1C292.3 58.7 292.9 59.4 295.0 60.1L296.2 60.6L302.9 60.5C310.2 60.5 310.2 60.5 310.7 59.5C311.0 59.1 311.0 56.8 311.0 40.9L311.0 22.8L311.4 22.4L311.8 22.0L317.6 22.0L323.4 22.1L323.7 22.5C324.0 22.9 324.0 23.5 324.0 46.5L324.0 70.2L323.6 70.6L323.2 71.0L308.4 71.0C300.2 71.0 293.1 70.9 292.6 70.8ZM338.4 70.6L338.0 70.2L338.0 46.5L338.0 22.8L338.4 22.4L338.8 22.0L352.1 22.0L365.4 22.1L367.4 22.7C372.3 24.2 374.2 25.4 375.6 28.5C375.8 29.0 376.0 29.6 376.0 29.9C376.0 30.1 376.2 30.8 376.5 31.4L376.9 32.4L377.0 37.5L377.0 42.5L376.6 42.9L376.2 43.3L370.9 43.3C363.9 43.3 364.4 43.6 364.1 39.3C363.9 36.0 363.5 34.9 362.0 33.6C360.2 32.1 359.4 31.8 354.7 31.6L352.6 31.5L352.0 31.9C351.7 32.2 351.4 32.6 351.3 32.8C351.2 33.0 351.2 41.1 351.2 51.4C351.2 63.3 351.1 69.8 351.0 70.1C350.7 71.0 350.4 71.0 344.4 71.0L338.8 71.0L338.4 70.6ZM464.9 70.8C464.5 70.8 463.4 70.6 462.6 70.4C461.8 70.2 460.7 69.9 460.2 69.9C458.8 69.6 455.6 68.4 453.9 67.5C453.0 67.1 449.8 64.8 449.0 64.1C448.3 63.4 445.0 57.6 445.0 56.9C445.0 56.8 444.8 56.1 444.5 55.5C444.1 54.5 444.0 54.2 444.0 52.8C444.0 51.9 443.9 50.8 443.7 50.2C443.3 48.4 443.2 44.9 443.6 42.5C443.8 41.4 444.0 40.0 444.0 39.5C444.0 38.9 444.1 38.4 444.3 37.9C444.7 37.3 444.9 36.6 445.9 33.8C447.1 30.3 450.2 26.9 453.7 24.9C455.8 23.7 459.3 22.5 461.6 22.2C463.6 21.9 485.4 21.9 486.1 22.2C486.9 22.6 487.0 23.2 487.0 27.3L486.9 30.9L486.5 31.2C486.1 31.6 486.0 31.6 476.7 31.6C467.3 31.7 464.8 31.8 463.8 32.2C461.8 33.1 459.3 35.7 459.1 37.2C459.0 37.5 458.8 38.2 458.6 38.7C458.2 39.6 458.2 39.7 458.4 40.1C458.8 41.0 458.1 41.0 476.8 41.0L494.2 41.0L494.6 41.4L495.0 41.8L495.0 46.3C494.9 50.8 494.9 50.9 494.5 51.2C494.2 51.5 493.5 51.5 477.0 51.4C458.4 51.4 459.0 51.3 458.4 52.2C458.0 52.8 458.1 53.9 458.7 55.5C459.6 57.6 461.8 59.4 464.1 59.8C467.9 60.5 468.7 60.6 477.1 60.6C481.7 60.6 485.7 60.7 486.0 60.8C486.9 60.9 487.0 61.3 487.0 66.0L487.0 70.2L486.6 70.6L486.2 71.0L476.0 71.0C470.3 71.0 465.4 70.9 464.9 70.8ZM558.4 70.6L558.0 70.2L558.0 46.7C558.0 29.6 558.1 23.1 558.2 22.8C558.5 22.0 558.4 22.0 574.4 22.0L589.6 22.1L591.7 22.6C597.6 24.2 600.1 26.1 602.3 30.9C603.0 32.3 603.0 32.5 603.0 33.9C603.0 34.9 603.1 35.9 603.4 36.8C603.7 38.1 603.7 38.3 603.8 54.0L603.9 70.0L603.4 70.4L603.0 70.9L597.2 70.9L591.3 70.9L590.9 70.5C590.3 69.8 590.3 68.6 590.3 52.6C590.4 39.4 590.3 38.0 590.1 36.8C589.8 35.4 589.2 34.4 588.0 33.2C586.5 31.7 586.7 31.8 579.3 31.7C572.5 31.6 572.1 31.6 571.5 32.3L571.1 32.7L571.0 51.5L570.9 70.4L570.5 70.7C570.2 71.0 569.8 71.0 564.5 71.0L558.8 71.0L558.4 70.6ZM418.8 60.3C419.7 59.7 419.7 60.0 419.7 45.9L419.7 32.6L419.1 32.2L418.6 31.7L413.0 31.7C406.0 31.7 404.2 31.9 403.1 32.7C402.7 33.0 401.9 33.5 401.5 33.8C401.0 34.1 400.4 34.5 400.2 34.7C398.9 35.9 397.0 39.1 397.0 40.2C397.0 40.5 396.8 41.8 396.6 43.2C396.1 45.9 396.1 47.5 396.7 49.8C396.8 50.6 397.0 51.6 397.0 52.0C397.0 54.5 399.8 58.2 402.6 59.3C403.7 59.8 405.9 60.3 407.4 60.6C407.7 60.6 410.3 60.6 413.2 60.6C417.9 60.6 418.5 60.6 418.8 60.3ZM42.3 58.2C44.2 57.3 45.2 56.3 46.2 54.4C47.1 52.5 47.3 50.4 46.7 48.7C46.5 48.2 46.2 47.4 46.1 47.0C45.6 45.6 43.9 44.1 41.3 43.2C41.1 43.1 36.2 43.0 29.1 43.0C16.4 42.9 16.7 42.9 16.3 43.8C16.1 44.4 16.1 57.7 16.4 58.2C16.7 59.0 16.7 59.0 29.1 58.9L40.9 58.9L42.3 58.2ZM41.1 30.4C43.9 29.5 45.5 28.2 46.0 26.6C46.1 26.2 46.4 25.5 46.6 25.1C47.2 23.8 47.2 22.0 46.5 20.5C46.3 19.9 45.9 19.1 45.8 18.6C45.4 17.5 43.9 16.2 42.3 15.5C40.7 14.8 38.8 14.7 26.2 14.7C16.8 14.8 16.8 14.8 16.3 15.7C16.2 15.9 16.1 18.2 16.1 22.8C16.1 29.0 16.1 29.7 16.4 30.1C17.0 31.0 16.9 31.0 28.6 31.0L39.4 31.0L41.1 30.4ZM76.8 15.8C74.0 15.8 74.0 15.7 73.5 15.3L73.1 14.8L73.0 9.8C73.0 4.2 73.0 3.7 73.8 3.3C74.5 2.9 85.1 2.9 85.8 3.2C86.6 3.6 86.6 4.1 86.6 9.4C86.7 16.2 86.9 15.8 82.4 15.9C80.9 15.9 78.3 15.9 76.8 15.8Z";
const LOGO_BARS=[[122.5,2.2,73.8,11.7],[277.0,2.3,327.3,11.5],[443.0,81.0,161.0,11.3],[1.8,81.2,375.8,11.2]];
const logo=(txt,cls='')=>`<svg class="${cls}" viewBox="0 0 606 94" role="img" aria-label="Bike Surgeon">${LOGO_BARS.map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#F8C018"/>`).join('')}<path d="${LOGO_PATH}" fill="${txt}" fill-rule="evenodd"/></svg>`;
const I_portal={
 dash:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 bike:'<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>',
 wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
 cam:'<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
 truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
 box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 chart:'<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
 receipt:'<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 9h8M8 13h6"/>',
 sliders:'<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
 search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
 chev:'<path d="m9 18 6-6-6-6"/>', back:'<path d="m15 18-6-6 6-6"/>',
 check:'<path d="M20 6 9 17l-5-5"/>', phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
 msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>', menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
 doc:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h5"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 page:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>', moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>'};
const I_admin={
 home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
 receipt:'<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 9h8M8 13h6"/>',
 wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
 box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
 chart:'<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', chev:'<path d="m9 18 6-6-6-6"/>', down:'<path d="m6 9 6 6 6-6"/>', back:'<path d="m15 18-6-6 6-6"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>', menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', check:'<path d="M20 6 9 17l-5-5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
 bike:'<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>',
 download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
 printer:'<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
 msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>', undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
 truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
 cart:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2.6l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 swap:'<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', filter:'<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>', more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
 tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>', doc:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h8M8 17h5"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/>'};
const I={...I_admin,...I_portal};
I.target='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>';
const ic=(n,cls='i')=>`<svg class="${cls}" viewBox="0 0 24 24">${I[n]||I.doc}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=(n,d=0)=>(n<0?'−₹':'₹')+Math.abs(Number(n||0)).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const pill=(t,c)=>`<span class="pill p-${c}">${esc(t)}</span>`;
const av=(ini,col,size=34)=>`<span class="avatar p-${col}" style="width:${size}px;height:${size}px">${esc(ini)}</span>`;
const initials=n=>{const w=String(n).replace(/[^A-Za-z ]/g,' ').trim().split(/\s+/);return ((w[0]||'')[0]||'').toUpperCase()+(w[1]?w[1][0]:(w[0]||'').slice(1,2)).toUpperCase();};

// ---------------- Bike Surgeon Inventory · same building blocks as the other portals
I.scan='<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8"/>';
I.layers='<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>';
I.camera='<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>';
I.list='<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>';
const BOOTED=BOOT;let S=BOOT;const ME_U=S.me;
const ROLE=ME_U.role,BOSS=ROLE==='owner'||ROLE==='manager',STAFF=BOSS||ROLE==='store',COST=BOSS||ROLE==='accountant',OWNER=ROLE==='owner',PAYS=BOSS||ROLE==='accountant';
const CASH=ROLE==='cashier',SUP=ROLE==='supervisor',CTR=ROLE==='counter',NEWROLE=CASH||SUP||CTR,UPL=PAYS||CASH;   // Inventory 2.0 roles see only their own pages
const UI={route:'dash',param:null,store:'BS',menu:false,nt:false,q:'',f:'',brand:'',sort:'name',page:1,sel:new Set(),tab:''};
let OV=null,DATA=null,BUSY=false,ALERTS=null,LASTERR=null;
const root=document.getElementById('root');
const num=v=>Number(String(v??'').replace(/[₹,\s]/g,''))||0;
const qs=o=>Object.entries(o).filter(([,v])=>v!==''&&v!=null&&v!==false).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
const dmy=s=>{if(!s)return '—';const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/);if(!m)return esc(s);const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${+m[3]} ${MON[+m[2]-1]} ${m[1]}${m[4]?' · '+m[4]:''}`;};
const val=id=>{const el=document.getElementById(id);return el?(el.type==='checkbox'?el.checked:el.value.trim()):'';};
const STORES=()=>S.lists.stores;
// ---- the billing link (server/billing.js): a live store is read straight from its billing every few seconds, so its parts,
// stock and prices change there only (until switch day); the Bike Pharma restock pieces go into the Bike Surgeon billing too
const LV=()=>S.live||{on:false};
const isLive=s=>!!(LV().on&&LV().stores&&LV().stores[s]);
const lockedS=s=>isLive(s)||(s==='BP'&&!!LV().on);
const freeStores=()=>Object.keys(STORES()).filter(s=>!lockedS(s));
const liveAt=()=>LV().sec?`checked ${LV().sec}`:'';
function liveBar(s,what){if(!lockedS(s))return '';const x=(LV().stores||{})[s==='BP'?'BS':s]||{};const wait=!x.ok&&!x.at&&!x.err,bad=!x.ok&&!wait,nm=esc(String(x.name||'billing').replace(/^the /i,''));
 return `<div class="livebar ${bad?'bad':''}" role="status">${ic(bad?'alert':'refresh')}<span class="cell2"><b>${wait?`Reading the ${nm} …`:bad?`${esc(x.name||'Billing')}: last read did not work`:`Live from the ${nm}`} <small class="muted" data-live-at>${esc(liveAt())}</small></b><small>${bad&&x.err?`${esc(x.err)} · `:''}${what||'Parts, stock and prices change only in the billing until switch day. A bill or a change there shows here within seconds.'}</small></span>${x.site?`<a class="btn sm" href="${esc(x.site)}" target="_blank" rel="noopener">${ic('page')} Open billing</a>`:''}</div>`;}
const WHY={'sale':['Sale','blue'],'sale-cancel':['Bill cancelled','gray'],'stock-in':['Stock in','green'],'transfer-in':['From RNR','teal'],'transfer-out':['To RNR','violet'],'count':['Rack check','orange'],'reduce':['Stock cut','red'],'return-in':['Customer return','teal'],'vendor-return':['Back to vendor','violet'],'edit':['Rows joined','gray'],'import':['Old site','gray'],'workshop':['Workshop','blue'],'billing':['Billing','blue']};
const whyPill=w=>{const x=WHY[w]||[w,'gray'];return pill(x[0],x[1]);};
const stockPill=p=>p.stock<0?pill(`${p.stock} below 0`,'red'):p.stock===0?pill('Out','red'):p.low?pill(`${p.stock} low`,'orange'):`<b class="num">${p.stock}</b>`;

// ---- API: each change answers {ok,msg}; the page loads fresh data after it
async function api(method,path,body){
 if(BUSY&&method!=='GET')return null;
 if(method!=='GET')BUSY=true;
 LASTERR=null;
 try{const r=await fetch('/api'+path,{method,headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
  if(r.status===401){location.reload();return null;}
  const ct=r.headers.get('content-type')||'';const d=ct.includes('json')?await r.json().catch(()=>({})):await r.text();
  BUSY=false;
  if(!r.ok){LASTERR=d&&typeof d==='object'?d:{};toast((d&&d.error)||'Could not do it. Try again.');if(d&&d.sameId)OV={...(OV||{}),sameId:d.sameId};return null;}
  return d;
 }catch(e){BUSY=false;toast('No connection. Check the internet and try again.');return null;}}
async function refreshState(){const d=await api('GET','/state');if(d)S=d;}
// Manager: no email (Sam, 5 Nov). A popup in the system when items wait for the selling price: on opening the panel,
// when new items come, and again every 30 minutes while they still wait. Checked every 2 minutes.
const NAG={n:0,at:0};
function priceNag(){if(ROLE!=='manager')return;const n=(S.flow||{badges:{}}).badges.pricing||0;
 const old=document.getElementById('pnag');if(!n||UI.route==='pricing'){if(old)old.remove();if(!n)NAG.n=0;return;}if(old)return;
 if(n<=NAG.n&&Date.now()-NAG.at<30*60000)return;NAG.n=n;NAG.at=Date.now();
 const el=document.createElement('div');el.className='scrim';el.id='pnag';
 el.innerHTML=`<div class="modal" role="alertdialog" aria-labelledby="pnag-h"><h2 id="pnag-h" style="font-size:18px">${ic('tag')} New stock waiting for your price</h2><p><b class="blink" style="padding:2px 8px;border-radius:8px">${n}</b> item${n>1?'s':''} assigned by the Supervisor. Counters cannot put ${n>1?'them':'it'} into stock until you add the selling price (1 day).</p><div class="row"><button class="btn pri" id="pnag-go">${ic('check')} Open New stock · price</button><button class="btn" id="pnag-x">Later</button></div></div>`;
 try{if(window.parent!==window)window.parent.postMessage({bsNag:{title:'Inventory: new stock waiting for your price',text:`${n} item${n>1?'s':''} assigned by the Supervisor. Counters cannot put ${n>1?'them':'it'} into stock until you add the selling price (1 day).`,button:'Open New stock · price',route:'pricing'}},location.origin);}catch(e){}
 document.body.appendChild(el);el.querySelector('#pnag-go').onclick=()=>{el.remove();go('pricing');};el.querySelector('#pnag-x').onclick=()=>el.remove();}
addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.bsGo&&ROUTES[e.data.bsGo]&&routeOk(e.data.bsGo))go(e.data.bsGo);});
if(ROLE==='manager')setInterval(async()=>{if(document.hidden)return;await refreshState();priceNag();},120000);
// the billing link: every 4 seconds a tiny question; when the billing changed, the open stock page loads again (not while
// someone types or a form is open: then right after)
const LIVE_PAGES=['dash','parts','nophoto','part','reorder','moves','datacheck'];let LIVE_DIRTY=false;
async function liveTick(){if(document.hidden||BUSY)return;let d=null;
 try{const r=await fetch('/api/live',{cache:'no-store'});if(r.status===401){location.reload();return;}if(r.ok)d=await r.json();}catch(e){return;}
 if(!d||typeof d!=='object')return;if(d.ver!==LV().ver)LIVE_DIRTY=true;S.live=d;
 document.querySelectorAll('[data-live-at]').forEach(el=>{el.textContent=liveAt();});
 const a=document.activeElement;if(!LIVE_DIRTY||OV||UI.nt||!LIVE_PAGES.includes(UI.route)||(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))return;
 LIVE_DIRTY=false;await refreshState();await load();}
if(LV().on)setInterval(liveTick,4000);
{const _render=render;render=function(){_render.apply(this,arguments);priceNag();};}
// a change, then fresh state and the page again
async function act(method,path,body,after){const d=await api(method,path,body);if(!d)return null;if(d.msg)toast(d.msg);OV=null;await refreshState();if(after)await after(d);else await load();return d;}
function toast(t){const el=document.createElement('div');el.className='toast';el.textContent=t;el.setAttribute('role','status');document.body.appendChild(el);setTimeout(()=>el.remove(),3200);}

// ---- navigation
const NAV=[
 ['STOCK',[['dash','Dashboard','dash'],['parts','Parts list','box'],['add','Add part','plus'],['stockin','Stock in (vendor bill)','truck'],['reorder','Low stock & reorder','alert',()=>(S.kpis[UI.store]||{}).alertLow],['orders','Daily order sheet','cal',()=>S.kpis.orders]]],
 ['CHECKS',[['counts','Rack checks','scan',()=>S.kpis.counts],['nophoto','Parts without photo','camera'],['datacheck','Data check','shield'],['moves','Stock log','list']]],
 [SUP?'INVENTORY LIST':'BIKE PHARMA RESTOCK',[['upload','Upload vendor bill','upload'],['myup',CASH?'My uploads':'Uploaded bills','doc'],['newstock','New stock','box',()=>(S.flow||{badges:{}}).badges.newStock,'blink'],['pricing','New stock · price','tag',()=>(S.flow||{badges:{}}).badges.pricing,'blink'],['counter',CTR?'My counter':'Counters','layers',()=>(S.flow||{badges:{}}).badges.counter],['tracker','Restock tracker','clock']]],
 ['MONEY',[['dues','Dues & payments','wallet',()=>(S.flow||{badges:{}}).badges.dues],['paycal','Payment calendar','cal'],['vendors','Vendors','users'],['bills','Vendor bills','receipt',()=>S.kpis.vendors.lateBills]]],
 ['MORE',[['transfers','Transfers DVG ⇄ RNR','swap'],['reports','Reports & sheets','chart'],['settings',NEWROLE?'My PIN':'Settings','gear']]],
];
function sidebar(){
 return `<aside class="side ${UI.menu?'open':''}" id="side"><button class="brand" data-go="dash">${logo('#FFFFFF')}<small>Inventory · ${esc(STORES()[UI.store])}</small></button>
 ${NAV.map(([g,all])=>{const items=all.filter(x=>routeOk(x[0]));return items.length?`<nav class="navg" aria-label="${g}"><h4>${g}</h4>${items.map(([r,l,i,b,c])=>{const n=b?b():0;return `<button class="nav ${UI.route===r?'on':''}" data-go="${r}">${ic(i)}<span>${l}</span>${n?`<span class="badge ${c||''}">${n}</span>`:''}</button>`;}).join('')}</nav>`:'';}).join('')}
 <button class="me" data-act="logout" title="Sign out"><span class="avatar">${esc(initials(ME_U.name))}</span><span><b>${esc(ME_U.name)}</b><span>${esc(ME_U.roleLabel)} · Sign out</span></span></button></aside>`;}
function storeSeg(){return `<div class="seg" role="group" aria-label="Store">${Object.entries(STORES()).filter(([k])=>!(k==='BP'&&LV().on)).map(([k,l])=>`<button class="${UI.store===k?'on':''}" data-act="store" data-s="${k}">${esc(l)}</button>`).join('')}</div>`;}
function topbar(title,sub,right=''){
 return `<div class="top"><div><h1>${title}</h1><p>${sub}</p></div><div class="tools" style="position:relative">
 ${NEWROLE?'':`<form class="search" data-form="scan" style="cursor:text" role="search">${ic('scan')}<input id="scanq" class="" style="border:0;background:none;outline:none;flex:1;min-width:0" placeholder="Scan barcode or type part no. / name" autocomplete="off"><span class="kbd">Enter</span></form>`}
 <button class="iconbtn" data-act="nt" aria-label="Alerts">${ic('bell')}${S.unseen?'<span class="dot"></span>':''}</button>${right}
 ${UI.nt?`<div class="notif">${ALERTS===null?'<div class="empty">Loading…</div>':ALERTS.length?ALERTS.slice(0,30).map(a=>`<button data-act="alert" data-k="${esc(a.kind)}" data-ref="${esc(a.ref)}"><b style="font-size:13px">${a.seen?'':'● '}${esc(dmy(a.at))}</b><br><small class="muted">${esc(a.text)}</small></button>`).join(''):'<div class="empty">No alerts</div>'}</div>`:''}</div></div>`;}
function shell(page){
 root.innerHTML=`<div class="mobilebar">${logo('#FFFFFF','logo')}<div class="row"><button data-act="nt" aria-label="Alerts">${ic('bell')}</button><button data-act="menu" aria-label="Menu">${ic('menu')}</button></div></div><div class="app">${sidebar()}<main class="main">${page}</main></div>${overlay()}`;}
function go(route,param){UI.route=route;UI.param=param??null;UI.menu=false;UI.nt=false;OV=null;UI.page=1;UI.sel=new Set();
 try{history.replaceState(null,'','#'+route+(param!=null?'/'+encodeURIComponent(param):''))}catch(e){}
 load();window.scrollTo(0,0);}
async function load(){
 if(!ROUTES[UI.route]||!routeOk(UI.route)){UI.route=HOME;UI.param=null;}
 if(UI.store==='BP'&&LV().on)UI.store='BS';
 const r=ROUTES[UI.route];
 try{DATA=r.data?await r.data():null;}catch(e){DATA=null;}
 render();}
function render(){const f=document.activeElement&&document.activeElement.id;let pos=null;try{pos=f&&document.activeElement.selectionStart;}catch(e){}
 shell((ROUTES[UI.route]||ROUTES[HOME]).view(DATA));
 if(f){const el=document.getElementById(f);if(el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA')){el.focus();try{if(pos!=null)el.setSelectionRange(pos,pos)}catch(e){}}}}

// ---- small blocks
const kpi=(l,v,n,goTo)=>`<${goTo?`button class="kpi" data-go="${goTo}"`:'div class="kpi"'}><span class="l">${l}</span><span class="v${String(v).replace(/<[^>]*>/g,'').length>9?' long':''}">${v}</span>${n?`<span class="n">${n}</span>`:''}</${goTo?'button':'div'}>`;
const table=(head,rows,empty='Nothing here')=>rows.length?`<div class="tablewrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<div class="empty">${empty}</div>`;
const card=(title,body,right='',sub='')=>`<section class="card"><div class="card-h"><h2>${title}${sub?`<span class="sub">${sub}</span>`:''}</h2><div class="row">${right}</div></div>${body}</section>`;
const partCell=p=>`<div class="cell2"><b>${esc(p.name)}</b><small><span class="mono">${esc(p.pno)}</span>${p.model?' · '+esc(p.model):''}${p.brand?' · '+esc(p.brand):''}</small></div>`;
const field=(id,label,v='',o={})=>`<label class="field" for="${id}">${label}${o.type==='select'?`<select class="sel" id="${id}">${o.opts.map(x=>{const [k,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(k)}" ${String(k)===String(v)?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`:o.type==='area'?`<textarea class="inp" id="${id}" rows="${o.rows||3}" placeholder="${esc(o.ph||'')}">${esc(v)}</textarea>`:o.type==='check'?`<span class="row" style="font-weight:500"><input type="checkbox" id="${id}" ${v?'checked':''}> ${esc(o.text||'')}</span>`:`<input class="inp" id="${id}" value="${esc(v??'')}" placeholder="${esc(o.ph||'')}" ${o.num?'inputmode="decimal"':''} ${o.type?`type="${o.type}"`:''} ${o.list?`list="${o.list}"`:''} autocomplete="off">`}</label>`;
const grid=(cols,html)=>`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cols}px,1fr))">${html}</div>`;
const modal=(title,body,form,wide)=>`<div class="scrim" data-act="close-ov"><form class="modal ${wide?'wide':''}" data-stop data-form="${form}" novalidate><div class="between"><h2 style="font-size:18px">${title}</h2><button type="button" class="btn" data-act="close-ov" aria-label="Close">${ic('x')}</button></div>${body}</form></div>`;
const exportBtn=(kind,params={})=>`<a class="btn" href="/api/export/${kind}.csv?${qs(params)}" download>${ic('download')} CSV</a>`;

// ---------------- pages
const ROUTES={};
ROUTES.dash={data:async()=>{const [m,o,b]=await Promise.all([api('GET',`/moves?${qs({store:UI.store,limit:12})}`),api('GET','/orders'),api('GET','/bills?late=1')]);return {moves:(m||{}).moves||[],orders:o||{rows:[],late:[]},late:(b||{}).bills||[]};},
 view:d=>{const k=S.kpis[UI.store];const v=S.kpis.vendors;
 return `${topbar(`${greet()} ${esc(ME_U.name.split(' ')[0])}`,`${esc(S.clock.long)} · ${esc(STORES()[UI.store])}`,storeSeg())}${liveBar(UI.store)}
 <div class="kpis">${kpi('Parts in the list',k.parts.toLocaleString('en-IN'),`${k.pcs.toLocaleString('en-IN')} pieces in stock`,'parts')}${kpi('Stock value at MRP',inr(k.mrpValue),COST&&k.costValue!=null?`At cost ${inr(k.costValue)}`:'')}${kpi('Low stock',(k.alertLow||0).toLocaleString('en-IN'),`${(k.out||0).toLocaleString('en-IN')} out of stock`,'reorder')}${kpi('Without photo',k.noPhoto.toLocaleString('en-IN'),'Add 1 to 6 photos','nophoto')}${kpi('Dead stock (90 days)',k.dead.toLocaleString('en-IN'),'In stock, no sale','reports')}${k.neg?kpi('Below 0',k.neg,'Count these racks','datacheck'):''}${PAYS?kpi('Vendor dues',inr(v.due),v.lateBills?`${v.lateBills} late · ${inr(v.late)}`:'Nothing late','bills'):''}</div>
 <div class="grid g2">${card('Latest stock moves',table(['When','Part','Move','Qty','Stock','By'],d.moves.map(m=>`<tr class="click" data-act="part" data-id="${m.part}"><td class="mono" style="white-space:nowrap">${esc(dmy(m.at))}</td><td>${partCell(m)}</td><td>${whyPill(m.why)}<br><small class="muted">${esc(m.ref)}</small></td><td class="num"><b>${m.qty>0?'+':''}${m.qty}</b></td><td class="num">${m.after}</td><td>${esc(m.who)}</td></tr>`),'No moves yet'),`<button class="link" data-go="moves">Stock log ${ic('chev')}</button>`)}
 <div class="grid">${card('Order sheet today',`<div class="list">${d.orders.rows.filter(o=>['pending','partial'].includes(o.status)).slice(0,8).map(o=>`<div class="between"><span class="cell2"><b>${esc(o.name)}</b><small>${esc(o.vendor||'No vendor yet')}${o.promise?' · promised '+esc(dmy(o.promise)):''}</small></span>${pill(`${o.got}/${o.qty}`,o.got?'orange':'gray')}</div>`).join('')||'<div class="empty">Nothing waiting</div>'}</div>`,`<button class="link" data-go="orders">Open ${ic('chev')}</button>`)}
 ${PAYS?card('Late vendor bills',`<div class="list">${d.late.slice(0,6).map(b=>`<button class="between jcl" data-act="bill" data-id="${b.id}"><span class="cell2"><b>${esc(b.vendor_name)}</b><small>${esc(b.inv_no)} · due ${esc(dmy(b.due))}</small></span><b class="num">${inr(b.balance)}</b></button>`).join('')||'<div class="empty">Nothing late</div>'}</div>`):''}</div></div>`;}};
function greet(){const h=new Date(S.clock.ms).getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}

// parts list (server pages it: 19,000+ parts)
const FILTERS=[['','All'],['instock','In stock'],['low','Low'],['out','Out / 0'],['neg','Below 0'],['nophoto','No photo'],['norack','No rack'],['noprice','No MRP'],['dead','Dead 90 days'],['removed','Removed']];
ROUTES.parts={data:()=>api('GET',`/parts?${qs({store:UI.store,q:UI.q,f:UI.f,brand:UI.brand,sort:UI.sort,page:UI.page})}`),view:d=>partsView(d,'Parts list')};
ROUTES.nophoto={data:()=>{UI.f='nophoto';return api('GET',`/parts?${qs({store:UI.store,q:UI.q,f:'nophoto',brand:UI.brand,sort:UI.sort,page:UI.page})}`);},view:d=>partsView(d,'Parts without photo')};
function partsView(d,title){d=d||{rows:[],total:0,page:1,pages:1};
 const brands=S.lists.brands.filter(b=>b.store===UI.store);
 const sel=UI.sel.size;
 return `${topbar(title,`${d.total.toLocaleString('en-IN')} parts · ${esc(STORES()[UI.store])}`,storeSeg())}${liveBar(UI.store)}
 <section class="card"><form class="row" data-form="pfilter" style="flex-wrap:wrap"><input class="inp" id="pq" value="${esc(UI.q)}" placeholder="Name, part no., model, brand, rack, barcode" style="flex:1;min-width:220px">
 <select class="sel" id="pb"><option value="">All brands</option>${brands.map(b=>`<option ${b.brand===UI.brand?'selected':''}>${esc(b.brand)}</option>`).join('')}</select>
 <select class="sel" id="ps">${[['name','Name A-Z'],['pno','Part no.'],['stock','Most stock'],['low','Lowest vs alert'],['rack','Rack'],['mrp','Highest MRP'],['new','Newest']].map(([k,l])=>`<option value="${k}" ${UI.sort===k?'selected':''}>${l}</option>`).join('')}</select>
 <button class="btn pri">${ic('search')} Search</button>${exportBtn('parts',{store:UI.store,q:UI.q,f:UI.f,brand:UI.brand})}</form>
 ${title==='Parts list'&&routeOk('newstock')?(n=>`<button class="nsbar ${n?'blink':''}" data-go="newstock">${ic('box')} New stock <b>${n}</b><small>${n?'bills waiting for the Supervisor':'nothing waiting'}</small></button>`)((S.flow||{badges:{}}).badges.newStock||0):''}
 <div class="chips">${FILTERS.map(([k,l])=>`<button class="chip ${UI.f===k?'on':''}" data-act="pf" data-f="${k}">${l}</button>`).join('')}</div>
 ${sel?`<div class="demo between"><b>${sel} picked</b><span class="row"><button class="btn" data-act="stickers">${ic('printer')} Print stickers</button>${BOSS&&!lockedS(UI.store)?`<button class="btn" data-act="bulk">${ic('sliders')} Change together</button>`:''}<button class="btn" data-act="sel-none">Clear</button></span></div>`:''}
 ${table(['<input type="checkbox" data-act="sel-all" aria-label="Pick all on this page">','Part','Rack','Stock','Alert','MRP','Customer / Mech / Whole',...(COST?['Cost']:[]),'Photo'],d.rows.map(p=>`<tr class="click" data-act="part" data-id="${p.id}"><td data-stop><input type="checkbox" data-act="sel" data-id="${p.id}" ${UI.sel.has(p.id)?'checked':''} aria-label="Pick ${esc(p.name)}"></td><td>${partCell(p)}</td><td class="mono">${esc(p.rack||'—')}</td><td>${stockPill(p)}</td><td class="num">${p.alert||'—'}</td><td class="num"><b>${inr(p.mrp,p.mrp%1?2:0)}</b></td><td class="num"><small>${inr(p.prices.user)} / ${inr(p.prices.mech)} / ${inr(p.prices.whole)}</small></td>${COST?`<td class="num">${inr(p.cost)}</td>`:''}<td>${p.photos.length?`<img src="${esc(p.photos[0].url)}" alt="" loading="lazy" style="width:40px;height:40px;object-fit:cover;border-radius:8px">`:p.photoCount?pill(`${p.photoCount} old`,'gray'):pill('None','orange')}</td></tr>`),'No part matches. Check the spelling or clear the filter.')}
 <div class="between"><span class="muted">Page ${d.page} of ${d.pages}</span><span class="row"><button class="btn" data-act="pg" data-p="${d.page-1}" ${d.page<=1?'disabled':''}>${ic('back')} Back</button><button class="btn" data-act="pg" data-p="${d.page+1}" ${d.page>=d.pages?'disabled':''}>Next ${ic('chev')}</button></span></div></section>`;}

// one part
ROUTES.part={data:()=>api('GET',`/parts/${UI.param}`),view:d=>{if(!d)return `${topbar('Part','Not found')}<div class="empty">This part was not found.</div>`;const p=d.part;
 const LK=lockedS(p.store),ED=!LK;
 // The Moto Lab bills at its own selling price (net cost price in its billing), not at MRP less a discount
 const pr=p.store==='ML'&&p.sell>0?[['Moto Lab bill price (as in its billing)',null,p.sell]]:[['Customer',p.dUser,p.prices.user],['Mechanic',p.dMech,p.prices.mech],['Wholesaler / dealer',p.dWhole,p.prices.whole]];
 return `${topbar(esc(p.name),`<span class="mono">${esc(p.pno)}</span> · ${esc(STORES()[p.store])}${p.model?' · '+esc(p.model):''}${p.active?'':' · '+pill('Removed','red')}`,`<button class="btn" data-go="parts">${ic('back')} Parts</button>`)}${liveBar(p.store,'Change this part (name, prices, discounts, GST, rack, alert, stock) in the billing: it shows here within seconds. Photos and the order sheet stay here.')}
 <div class="grid g2"><section class="card"><div class="card-h"><h2>Details</h2><div class="row">${STAFF&&ED?`<button class="btn" data-act="edit-part">${ic('doc')} Edit</button>`:''}<button class="btn" data-act="stickers-one" data-id="${p.id}">${ic('printer')} Sticker</button></div></div>
 ${grid(150,[['Brand',p.brand],['Model',p.model],['Rack',p.rack],['HSN',p.hsn],['GST',p.gst+' %'+(p.gstIncl?' (in MRP)':' (on top)')],['Batch',p.batch],['Barcode',p.bar||p.pno],[p.store==='ML'?'Category / size':'Description',p.store==='ML'?[p.cat,p.size].filter(Boolean).join(' · '):p.descr],...(p.wty?[['Warranty',p.wty+' months']]:[]),['Added',`${p.addedBy} · ${dmy(p.addedAt)}`],['Last sale',dmy(p.lastSale)]].map(([l,v])=>`<div class="cell2"><small>${l}</small><b>${esc(v||'—')}</b></div>`).join(''))}
 <div class="kpis">${kpi('In stock',p.stock,p.alert?`Alert at ${p.alert}`:'No alert set')}${kpi('MRP',inr(p.mrp,2),COST?`Cost ${inr(p.cost,2)}${p.mrp>0?` · margin ${Math.round((1-p.cost/p.mrp)*100)} %`:''}`:'')}${kpi('Sold in 90 days',d.sales.qty90,`${d.sales.bills90} bills`)}</div>
 ${table(['Price for','Discount','Price'],pr.map(([l,dd,v])=>`<tr><td>${l}</td><td class="num">${dd==null?'—':dd+' %'}</td><td class="num"><b>${inr(v,2)}</b></td></tr>`))}
 <div class="row" style="flex-wrap:wrap">${BOSS&&ED?`<button class="btn" data-act="reduce">${ic('undo')} Cut stock</button>`:''}${STAFF&&ED?`<button class="btn" data-act="return-in">${ic('undo')} Customer return</button>`:''}${STAFF?`<button class="btn" data-act="order-add" data-id="${p.id}">${ic('cart')} Add to order sheet</button>`:''}${BOSS&&ED?`<button class="btn" data-act="vreturn">${ic('truck')} Back to vendor</button>`:''}${BOSS&&ED&&p.active?`<button class="btn" data-act="part-off">${ic('x')} Remove from list</button>`:''}${BOSS&&ED&&!p.active?`<button class="btn" data-act="part-on">${ic('check')} Back in the list</button>`:''}</div>
 ${d.same.length?`<div class="demo">Same part number also on: ${d.same.map(x=>`<button class="link" data-act="part" data-id="${x.id}">${esc(x.name)} (${esc(x.model||STORES()[x.store])}, stock ${x.stock})</button>`).join(', ')}${BOSS&&ED?` · <button class="link" data-act="join" data-ids="${d.same.filter(x=>x.store===p.store).map(x=>x.id).join(',')}">Join them into this row</button>`:''}</div>`:''}</section>
 <div class="grid">${card('Photos',`<div class="row" style="flex-wrap:wrap;gap:10px">${p.photos.map(ph=>`<span style="position:relative"><a href="${esc(ph.url)}" target="_blank" rel="noopener"><img src="${esc(ph.url)}" alt="${esc(p.name)}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:1px solid var(--line)"></a>${STAFF?`<button class="btn sm" data-act="photo-del" data-pid="${ph.id}" style="position:absolute;top:4px;right:4px" aria-label="Remove photo">${ic('x')}</button>`:''}</span>`).join('')||`<div class="empty" style="width:100%">${p.photoCount?'Old photos are on the old billing site (set OLD_PHOTO_URL to show them).':'No photo yet'}</div>`}</div>
 ${STAFF&&p.photoCount<6?`<label class="btn pri" style="align-self:flex-start">${ic('camera')} Add photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-act="photo" multiple hidden></label><small class="muted">Saved as taken, full quality. Up to 6 photos.</small>`:''}`)}
 ${card('Open orders',`<div class="list">${d.orders.map(o=>`<div class="between"><span>${esc(dmy(o.day))} · ${esc(o.vendor||'—')}</span>${pill(`${o.got}/${o.qty}`,'orange')}</div>`).join('')||'<div class="empty">Not on the order sheet</div>'}</div>`)}
 ${COST?card('Last buys',table(['Bill','Vendor','Qty','Rate','MRP'],d.buys.map(b=>`<tr><td><span class="cell2"><b class="mono">${esc(b.no)}</b><small>${esc(b.inv_no)} · ${esc(dmy(b.inv_date))}</small></span></td><td>${esc(b.vendor)}</td><td class="num">${b.qty}</td><td class="num">${inr(b.rate,2)}</td><td class="num">${inr(b.mrp)}</td></tr>`),'No vendor bill yet')):''}</div></div>
 ${card('Stock moves',table(['When','Move','Qty','Before → after','Ref','From','By','Note'],d.moves.map(m=>`<tr><td class="mono" style="white-space:nowrap">${esc(dmy(m.at))}</td><td>${whyPill(m.why)}</td><td class="num"><b>${m.qty>0?'+':''}${m.qty}</b></td><td class="num">${m.before} → ${m.after}</td><td class="mono">${esc(m.ref)}</td><td>${esc(m.src)}</td><td>${esc(m.who)}</td><td><small>${esc(m.note)}</small></td></tr>`),'No moves yet'),'','last 100')}
 ${card('Last sales',table(['Bill','Day','Qty','Rate','From'],d.sales.last.map(s=>`<tr><td class="mono">${esc(s.bill)}</td><td>${esc(dmy(s.day))}</td><td class="num">${s.qty}</td><td class="num">${inr(s.rate,2)}</td><td>${esc(s.src)}</td></tr>`),'No sale seen yet'))}`;}};

// add / edit part form (same for both)
function partForm(p,isNew){p=p||{store:lockedS(UI.store)?(freeStores()[0]||UI.store):UI.store,gst:18,gstIncl:true,dUser:0,dMech:0,dWhole:0,alert:1};const ml=p.store==='ML';
 return `${grid(200,[
  isNew?field('fstore','Store',p.store,{type:'select',opts:Object.entries(STORES()).filter(([k])=>!lockedS(k))}):'',
  field('fpno','Part number / SKU *',p.pno,{ph:'e.g. 15400-KWN-901'}),field('fname','Part name *',p.name,{ph:'e.g. Oil filter element'}),
  field('fbrand','Brand',p.brand,{list:'dlbrand'}),field('fmodel',ml?'Fits':'Model(s)',p.model,{ph:'Activa / Shine'}),
  ml?field('fcat','Category',p.cat,{type:'select',opts:S.lists.mlCats}):field('fdescr','Description',p.descr),ml?field('fsize','Size',p.size,{ph:'S, M, L …'}):'',
  field('fmrp','MRP (₹) *',p.mrp,{num:1}),COST?field('fcost','Cost price (₹)',p.cost,{num:1}):'',
  field('fgst','GST %',p.gst,{type:'select',opts:S.lists.gst.map(g=>[g,g+' %'])}),field('fincl','MRP includes GST',p.gstIncl,{type:'check',text:'Yes'}),field('fhsn','HSN code',p.hsn,{num:1}),
  field('fdu','Customer discount %',p.dUser,{num:1}),field('fdm','Mechanic discount %',p.dMech,{num:1}),field('fdw','Wholesaler discount %',p.dWhole,{num:1}),
  isNew?field('fstock','Opening stock',p.stock||0,{num:1}):'',field('falert','Low-stock alert at',p.alert,{num:1}),field('frack','Rack',p.rack,{list:'dlrack'}),
  field('fbatch','Batch no.',p.batch),field('fbar','Barcode (if not the part no.)',p.bar),field('fwty','Warranty (months)',p.wty||0,{num:1}),
  ].join(''))}
 <datalist id="dlbrand">${[...new Set(S.lists.brands.map(b=>b.brand))].map(b=>`<option value="${esc(b)}">`).join('')}</datalist><datalist id="dlrack">${[...new Set(S.lists.racks.map(b=>b.rack))].map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
 ${OV&&OV.sameId?`<div class="demo">${field('fsame','',false,{type:'check',text:'Same number, different part (for example a different model). Add it anyway.'})} <button type="button" class="link" data-act="part" data-id="${OV.sameId}">Open the part already there</button></div>`:''}`;}
function partBody(isNew){const b={pno:val('fpno'),name:val('fname'),brand:val('fbrand'),model:val('fmodel'),mrp:num(val('fmrp')),gst:num(val('fgst')),gstIncl:val('fincl'),hsn:val('fhsn'),
 dUser:num(val('fdu')),dMech:num(val('fdm')),dWhole:num(val('fdw')),alert:num(val('falert')),rack:val('frack'),batch:val('fbatch'),bar:val('fbar'),wty:num(val('fwty'))};
 if(document.getElementById('fdescr'))b.descr=val('fdescr');if(document.getElementById('fcat'))b.cat=val('fcat');if(document.getElementById('fsize'))b.size=val('fsize');
 if(COST&&document.getElementById('fcost'))b.cost=num(val('fcost'));if(isNew){b.store=val('fstore');b.stock=num(val('fstock'));}if(val('fsame'))b.sameNoOk=true;return b;}
ROUTES.add={view:()=>`${topbar('Add part','A new part number in the list. Stock that comes on a vendor bill goes through Stock in.')}<section class="card"><form data-form="add" novalidate class="grid">${partForm(null,true)}<div class="row"><button class="btn pri" style="padding:12px 18px">${ic('plus')} Add part</button><span class="muted">Then add 1 to 6 photos on the part page.</span></div></form></section>
 ${BOSS?card('Many parts from a sheet',`<p class="muted" style="margin:0">CSV with a heading row: <span class="mono">serial_no, name, brand, model, gross_selling_price (or mrp), net_cost_price, tax_rate, hsn, stock, stock_alert_on, rack, discount_to_user, discount_to_mechanic, discount_to_wholeseller</span>. The old billing sheet and this portal's own CSV both work. New part numbers are added with their stock; known numbers only get their details changed.</p>
 <div class="row" style="flex-wrap:wrap"><label class="btn">${ic('upload')} Pick CSV file<input type="file" accept=".csv,text/csv" data-act="csvfile" hidden></label><span class="muted" id="csvname">${OV&&OV.csvName?esc(OV.csvName):'No file picked'}</span><button class="btn" data-act="csv-check" ${UI.csv?'':'disabled'}>Check first</button><button class="btn pri" data-act="csv-load" ${UI.csvOk?'':'disabled'}>Load it</button></div>
 ${UI.csvOut?`<div class="demo"><b>${esc(UI.csvOut.msg)}</b>${UI.csvOut.errors.length?`<br>${UI.csvOut.errors.slice(0,20).map(esc).join('<br>')}`:''}${UI.csvOut.stockSkipped.length?`<br><b>Stock not changed from the sheet (use Stock in or a rack check):</b> ${UI.csvOut.stockSkipped.slice(0,10).map(x=>`${esc(x.pno)} now ${x.now}, sheet ${x.sheet}`).join('; ')}`:''}</div>`:''}`):''}`};

// stock in from a vendor bill
const SI={vendor:'',invNo:'',invDate:'',store:'BS',lines:[],amount:'',notes:'',dup:false};
ROUTES.stockin={view:()=>{if(lockedS(SI.store))SI.store=freeStores()[0]||SI.store;const vs=S.lists.vendors.filter(v=>v.active);const tot=SI.lines.reduce((s,l)=>s+num(l.qty)*num(l.rate)*(1+num(l.gst)/100),0);
 return `${topbar('Stock in','Type the vendor bill line by line. Stock goes up, the bill goes into vendor dues.')}
 <section class="card"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
 <label class="field">Vendor *<select class="sel" id="sv" data-act="si-f" data-k="vendor"><option value="">Pick vendor</option>${vs.map(v=>`<option value="${v.id}" ${String(v.id)===String(SI.vendor)?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
 ${field('sinv','Vendor bill no. *',SI.invNo)}${field('sdate','Bill date *',SI.invDate||S.clock.today,{type:'date'})}
 <label class="field">Store<select class="sel" id="sstore">${Object.entries(STORES()).filter(([k])=>!lockedS(k)).map(([k,l])=>`<option value="${k}" ${SI.store===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
 <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="si-add">${ic('search')} Add a part from the list</button><button class="btn" data-act="si-new">${ic('plus')} New part on this bill</button><button class="btn" data-act="vendor-new">${ic('users')} New vendor</button></div>
 ${table(['Part','Qty','Rate (₹, before GST)','GST %','MRP on box','Line total',''],SI.lines.map((l,i)=>`<tr><td>${l.part?partCell(l.p):`<div class="cell2"><b>${esc(l.new.name)}</b><small>New · <span class="mono">${esc(l.new.pno)}</span></small></div>`}</td>
  <td><input class="inp" style="width:70px" inputmode="numeric" id="slqty${i}" data-act="si-l" data-i="${i}" data-k="qty" value="${esc(l.qty)}" aria-label="Quantity"></td><td><input class="inp" style="width:110px" inputmode="decimal" id="slrate${i}" data-act="si-l" data-i="${i}" data-k="rate" value="${esc(l.rate)}" aria-label="Rate"></td>
  <td><select class="sel" id="slgst${i}" data-act="si-l" data-i="${i}" data-k="gst" aria-label="GST">${S.lists.gst.map(g=>`<option ${num(l.gst)===g?'selected':''} value="${g}">${g}</option>`).join('')}</select></td>
  <td><input class="inp" style="width:100px" inputmode="decimal" id="slmrp${i}" data-act="si-l" data-i="${i}" data-k="mrp" value="${esc(l.mrp)}" aria-label="MRP"></td><td class="num"><b>${inr(num(l.qty)*num(l.rate)*(1+num(l.gst)/100),2)}</b></td><td><button class="btn sm" data-act="si-del" data-i="${i}" aria-label="Remove line">${ic('x')}</button></td></tr>`),'Add the parts of the bill')}
 <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${field('samt','Bill total as printed (₹)',SI.amount,{num:1,ph:inr(Math.round(tot))})}${field('snotes','Note',SI.notes)}${SI.dup?field('sdup','',true,{type:'check',text:'Enter again (it really is a second bill)'}):''}</div>
 <div class="between"><span class="muted">Lines add up to <b>${inr(tot,2)}</b>${COST?'':' · cost prices are kept by the manager'}</span><button class="btn pri" data-act="si-save" style="padding:12px 18px" ${SI.lines.length?'':'disabled'}>${ic('check')} Save and add to stock</button></div></section>`;}};

// low stock & reorder
ROUTES.reorder={data:()=>api('GET',`/reorder?${qs({store:UI.store})}`),view:d=>{const rows=(d||{}).rows||[],tot=(d||{}).total||rows.length;
 return `${topbar('Low stock & reorder','Parts at or below their alert level, the most sold first. Suggested quantity = about a month of sale.',storeSeg())}
 ${card(tot>rows.length?`${tot.toLocaleString('en-IN')} parts to order <small class="muted">(the ${rows.length} most sold here, all of them in the CSV)</small>`:`${rows.length} parts to order`,table(['Part','Rack','Stock','Alert','Sold 90 days','On order','Suggest',''],rows.map(p=>`<tr><td><button class="jcl" data-act="part" data-id="${p.id}">${partCell(p)}</button></td><td class="mono">${esc(p.rack||'—')}</td><td>${stockPill(p)}</td><td class="num">${p.alert}</td><td class="num">${p.sold90}</td><td class="num">${p.onOrder||'—'}</td><td>${pill(`${p.suggest} · ${p.level}`,p.level==='Order now'?'red':'orange')}</td><td>${STAFF&&!p.onOrder?`<button class="btn sm" data-act="order-add" data-id="${p.id}" data-q="${p.suggest}">${ic('cart')} Order</button>`:''}</td></tr>`),'Nothing is low. Good.'),exportBtn('reorder',{store:UI.store}))}`;}};

// daily order sheet
ROUTES.orders={data:()=>api('GET',`/orders?${qs({day:UI.param||''})}`),view:d=>{d=d||{rows:[],late:[],day:S.clock.today};const open=d.rows.filter(o=>['pending','partial'].includes(o.status));
 return `${topbar('Daily order sheet',`${esc(dmy(d.day))} · ${open.length} waiting · rows not received move to the next day by themselves`,`<input class="inp" type="date" id="oday" value="${esc(d.day)}" data-act="oday" aria-label="Day">`)}
 ${d.late.length?card('Promised day passed',table(['Part','Vendor','Promised','Got'],d.late.map(o=>`<tr><td>${esc(o.name)} <small class="mono muted">${esc(o.pno)}</small></td><td>${esc(o.vendor)}</td><td>${pill(dmy(o.promise),'red')}</td><td class="num">${o.got}/${o.qty}</td></tr>`))):''}
 ${card('Orders',table(['Brand','Part','Qty','Got','Vendor','Promised','Status','By',''],d.rows.map(o=>`<tr><td>${esc(o.brand)}</td><td><div class="cell2"><b>${esc(o.name)}</b><small class="mono">${esc(o.pno)}${o.stock!=null?` · stock ${o.stock}`:''}</small></div></td><td class="num">${o.qty}</td><td class="num">${o.got}</td><td>${esc(o.vendor||'—')}</td><td>${esc(o.promise?dmy(o.promise):'—')}</td><td>${pill(o.status,{pending:'gray',partial:'orange',done:'green',cancelled:'red',carried:'violet'}[o.status])}</td><td>${esc(o.by)}</td>
 <td>${STAFF&&['pending','partial'].includes(o.status)?`<span class="row"><button class="btn sm" data-act="o-recv" data-id="${o.id}" data-left="${o.qty-o.got}">Received</button><button class="btn sm" data-act="o-edit" data-id="${o.id}">Edit</button><button class="btn sm" data-act="o-cancel" data-id="${o.id}" aria-label="Cancel">${ic('x')}</button></span>`:''}</td></tr>`),'No orders this day'),`${STAFF?`<button class="btn pri" data-act="order-free">${ic('plus')} Add a row</button>`:''}${exportBtn('orders',{day:d.day})}`)}`;}};

// rack checks
ROUTES.counts={data:()=>api('GET','/counts'),view:d=>{const rows=(d||{}).counts||[];
 return `${topbar('Rack checks','Count a rack; the difference goes into stock only when the manager applies it.')}
 ${card('Rack checks',table(['No.','Rack','Parts','Different','Value of difference','Counted by','Status'],rows.map(c=>`<tr class="click" data-go-count="${esc(c.no)}"><td class="mono"><b>${esc(c.no)}</b></td><td class="mono">${esc(c.rack||'—')}</td><td class="num">${c.n}</td><td class="num">${c.diff}</td><td class="num">${inr(c.value)}</td><td>${esc(c.by)}<br><small class="muted">${esc(dmy(c.at))}</small></td><td>${pill(c.status,{waiting:'orange',applied:'green',dropped:'gray'}[c.status])}</td></tr>`),'No rack check yet'),STAFF?`<button class="btn pri" data-act="count-new">${ic('scan')} Count a rack</button>`:'')}`;}};
ROUTES.count={data:()=>api('GET',`/counts/${encodeURIComponent(UI.param)}`),view:d=>{if(!d)return topbar('Rack check','Not found');const w=d.rows.some(r=>r.status==='waiting');
 const lk=d.rows.some(r=>lockedS(r.store)),dif=d.rows.filter(r=>r.status==='waiting'&&r.counted!==r.system).length;
 return `${topbar(`Rack check ${esc(d.no)}`,`${d.rows.length} parts · ${esc(d.rows[0].by)} · ${esc(dmy(d.rows[0].at))}`,`<button class="btn" data-go="counts">${ic('back')} Rack checks</button>`)}
 ${card('Counts',table(['Part','System had','Counted','Difference','Stock now','Status'],d.rows.map(r=>`<tr><td>${partCell(r)}</td><td class="num">${r.system}</td><td class="num"><b>${r.counted}</b></td><td class="num">${r.counted-r.system?pill((r.counted-r.system>0?'+':'')+(r.counted-r.system),r.counted<r.system?'red':'green'):'—'}</td><td class="num">${r.now}</td><td>${pill(r.status,{waiting:'orange',applied:'green',dropped:'gray'}[r.status])}</td></tr>`)),BOSS&&w?(lk&&dif?`<span class="muted">Stock comes from the billing: correct these ${dif} in the billing (it shows here within seconds), then press Drop. The count stays here as a record.</span><button class="btn" data-act="count-drop">Drop</button>`:`<button class="btn" data-act="count-drop">Drop</button><button class="btn pri" data-act="count-apply">${ic('check')} Apply to stock</button>`):'')}`;}};
const CNT={rack:'',lines:[]};
ROUTES.countnew={data:async()=>CNT.rack?api('GET',`/parts?${qs({store:UI.store,f:'',size:200,sort:'name',q:''})}&rack=${encodeURIComponent(CNT.rack)}`):null,view:d=>{const rows=d?d.rows:[];
 return `${topbar('Count a rack','Pick the rack, count each part on it and type what you see. Leave a part empty if you did not count it.',storeSeg())}
 <section class="card"><form class="row" data-form="cnt-rack" style="flex-wrap:wrap"><input class="inp" id="crack" list="dlr2" value="${esc(CNT.rack)}" placeholder="Rack, e.g. A2"><datalist id="dlr2">${S.lists.racks.filter(r=>r.store===UI.store).map(r=>`<option value="${esc(r.rack)}">${r.n} parts</option>`).join('')}</datalist><button class="btn">${ic('search')} Show parts</button></form>
 ${table(['Part','Counted'],rows.map(p=>`<tr><td>${partCell(p)}</td><td><input class="inp" style="width:90px" inputmode="numeric" data-cnt="${p.id}" aria-label="Count for ${esc(p.name)}"></td></tr>`),CNT.rack?'No part has this rack':'Type a rack')}
 ${rows.length?`<button class="btn pri" data-act="count-save" style="align-self:flex-start">${ic('check')} Save count</button>`:''}</section>`;}};

// data check
ROUTES.datacheck={data:()=>api('GET',`/data-check?${qs({store:UI.store})}`),view:d=>{if(!d)return topbar('Data check','');const c=d.counts;
 const sec=(t,rows,extra='')=>card(t,table(['Part','Stock','MRP',...(COST?['Cost']:[]),'GST','HSN'],rows.map(p=>`<tr class="click" data-act="part" data-id="${p.id}"><td>${partCell(p)}</td><td class="num">${p.stock}</td><td class="num">${inr(p.mrp)}</td>${COST?`<td class="num">${inr(p.cost)}</td>`:''}<td class="num">${p.gst}</td><td class="mono">${esc(p.hsn||'—')}</td></tr>`),'None'),extra);
 return `${topbar('Data check',lockedS(UI.store)?'Mistakes in the billing data. Fix them in the billing, one by one: they leave this list within seconds.':'Mistakes that came from the old billing site. Fix them here, one by one.',storeSeg())}
 <div class="kpis">${kpi('Same part no. twice',c.dups)}${kpi('Wrong GST in old site',c.gstFix)}${kpi('No MRP',c.noMrp)}${kpi('Stock below 0',c.neg)}${c.costOver!=null?kpi('Cost above MRP',c.costOver):''}${kpi('No HSN',c.noHsn)}${kpi('In stock, no rack',c.noRack)}</div>
 ${card('Same part number on more than one row',`<p class="muted" style="margin:0">Open the row to keep and press "Join them into this row": stock, photos, sales and bills move to it. Different parts that only share a number can stay.</p>${table(['Part no.','Rows','Total stock','Rows'],d.dups.map(x=>`<tr><td class="mono"><b>${esc(x.parts[0].pno)}</b></td><td class="num">${x.n}</td><td class="num">${x.stock}</td><td>${x.parts.map(p=>`<button class="link" data-act="part" data-id="${p.id}">${esc(p.name)}${p.model?' ('+esc(p.model)+')':''} · ${p.stock}</button>`).join('<br>')}</td></tr>`),'None')}`)}
 ${card('GST rate was wrong in the old site',`<p class="muted" style="margin:0">${lockedS(UI.store)?'The billing has a GST like 1039 % or 17 % on these parts and bills them at 18 % (its own rule). Check the vendor bill, set the right rate in the billing, then tick it off.':'These parts had a GST like 1039 % or 17 %. They were set to 18 %. Check the vendor bill, set the right rate on the part, then tick it off.'}</p>${table(['Part no.','Name','Old value',''],d.gstFix.map(x=>`<tr><td class="mono">${esc(x.pno)}</td><td>${esc(x.name)}</td><td>${pill(String(x.old)+' %','red')}</td><td>${BOSS?`<button class="btn sm" data-act="gst-done" data-pno="${esc(x.pno)}">Checked</button>`:''}</td></tr>`),'None')}`)}
 ${sec('No MRP',d.noMrp)}${sec('Stock below 0 (count these racks)',d.neg)}${COST?sec('Cost price above MRP',d.costOver):''}${sec('No HSN code',d.noHsn)}`;}};

// stock log
ROUTES.moves={data:()=>api('GET',`/moves?${qs({store:UI.store,q:UI.q2||'',why:UI.why||'',from:UI.from||'',to:UI.to||''})}`),view:d=>{const rows=(d||{}).moves||[];
 return `${topbar('Stock log','Every stock change, who did it and why. Nothing changes stock without a line here.',storeSeg())}
 <section class="card"><form class="row" data-form="mfilter" style="flex-wrap:wrap"><input class="inp" id="mq" value="${esc(UI.q2||'')}" placeholder="Part, part no. or ref" style="flex:1;min-width:200px"><select class="sel" id="mw"><option value="">All moves</option>${Object.entries(WHY).map(([k,[l]])=>`<option value="${k}" ${UI.why===k?'selected':''}>${l}</option>`).join('')}</select><input class="inp" type="date" id="mf" value="${esc(UI.from||'')}" aria-label="From"><input class="inp" type="date" id="mt" value="${esc(UI.to||'')}" aria-label="To"><button class="btn pri">${ic('filter')} Show</button>${exportBtn('moves',{store:UI.store,q:UI.q2,why:UI.why,from:UI.from,to:UI.to})}</form>
 ${table(['When','Part','Move','Qty','Before → after','Ref','From','By','Note'],rows.map(m=>`<tr class="click" data-act="part" data-id="${m.part}"><td class="mono" style="white-space:nowrap">${esc(dmy(m.at))}</td><td>${partCell(m)}</td><td>${whyPill(m.why)}</td><td class="num"><b>${m.qty>0?'+':''}${m.qty}</b></td><td class="num">${m.before} → ${m.after}</td><td class="mono">${esc(m.ref)}</td><td>${esc(m.src)}</td><td>${esc(m.who)}</td><td><small>${esc(m.note)}</small></td></tr>`),'No moves for this filter')}<small class="muted">Shows the latest 500. The CSV has up to 5,000.</small></section>`;}};

// vendors
ROUTES.vendors={data:()=>api('GET','/vendors'),view:d=>{const rows=(d||{}).vendors||[];
 return `${topbar('Vendors',`${rows.filter(v=>v.active).length} active · dues ${inr(rows.reduce((s,v)=>s+(v.active?v.due:0),0))}`,(STAFF||PAYS)?`<button class="btn pri" data-act="vendor-new">${ic('plus')} New vendor</button>`:'')}
 ${card('All vendors',table(['Vendor','GSTIN','Credit days','Pending bills','Late','Due','Last bill',''],rows.map(v=>`<tr class="click" data-act="vendor" data-id="${v.id}"><td><div class="cell2"><b>${esc(v.name)}</b><small>${esc(v.phone||'')}${v.brands?' · '+esc(v.brands):''}${v.address?' · '+esc(v.address.slice(0,50)):''}</small></div></td><td class="mono">${esc(v.gstin||'—')}</td><td class="num">${v.days}</td><td class="num">${v.pending}</td><td>${v.late?pill(v.late+' late','red'):'—'}</td><td class="num"><b>${inr(v.due)}</b></td><td>${esc(dmy(v.last))}</td><td>${v.active?'':pill('Off','gray')}${PAYS&&v.active&&!v.bankOk?pill('No bank details','orange'):''}</td></tr>`),'No vendor yet'))}`;}};
ROUTES.vendor={data:()=>api('GET',`/vendors/${UI.param}`),view:d=>{if(!d)return topbar('Vendor','Not found');const v=d.vendor;
 return `${topbar(esc(v.name),`${esc(v.gstin||'No GSTIN')} · ${v.days} credit days · due ${inr(v.due)}${v.opening?` (opening ${inr(v.opening)})`:''}`,`<button class="btn" data-go="vendors">${ic('back')} Vendors</button>${STAFF||PAYS?`<button class="btn" data-act="vendor-edit">${ic('doc')} Edit</button>`:''}`)}
 ${PAYS?card('Bank details for payment',v.bankOk?`<div class="grid g2e">${[['Account holder',v.acc_name],['Account number',v.acc_no],['IFSC',v.ifsc],['Bank',v.bank_name],['Branch',v.branch],['UPI',v.bank||'—']].map(([k,x])=>`<span class="cell2"><small class="muted">${k}</small><b class="${k==='Account number'||k==='IFSC'?'mono':''}">${esc(x)}</b></span>`).join('')}</div>`:`<div class="row">${pill('Bank details missing','orange')}<button class="btn sm" data-act="vendor-edit">Add bank details</button></div>`):''}
 ${card('Bills',billsTable(d.bills))}
 <div class="grid g2e">${card('Payments',table(['Day','Bill','Amount','Mode','Ref','By'],d.payments.map(p=>`<tr><td>${esc(dmy(p.day))}</td><td class="mono">${esc(p.inv_no)}</td><td class="num"><b>${inr(p.amount,2)}</b></td><td>${esc(p.mode)}</td><td>${esc(p.ref)}</td><td>${esc(p.by)}</td></tr>`),'No payment yet'))}
 ${card('Goods sent back',table(['No.','Part','Qty','Why','Status',''],d.returns.map(r=>`<tr><td class="mono">${esc(r.no)}</td><td>${esc(r.name)}</td><td class="num">${r.qty}</td><td>${esc(r.why)}</td><td>${pill(r.status,r.status==='Sent'?'orange':'green')}</td><td>${BOSS&&r.status==='Sent'?`<button class="btn sm" data-act="vr-done" data-no="${esc(r.no)}" data-s="Replaced">Replaced</button> <button class="btn sm" data-act="vr-done" data-no="${esc(r.no)}" data-s="Credit received">Credit</button>`:''}</td></tr>`),'Nothing sent back'))}</div>`;}};
const payLbl=b=>b.status==='CANCELLED'?'Cancelled':b.status==='CLEARED'?'Full paid':b.paid>0?'Partial paid':'Not paid';   // same words as Dues & payments
const billsTable=bills=>table(['No.','Vendor bill','Date','Due','Amount','Paid','Balance','Status'],bills.map(b=>`<tr class="click" data-act="bill" data-id="${b.id}"><td class="mono"><b>${esc(b.no)}</b></td><td><div class="cell2"><b>${esc(b.inv_no)}</b><small>${esc(b.vendor_name||'')}</small></div></td><td>${esc(dmy(b.inv_date))}</td><td>${b.late?pill(dmy(b.due),'red'):esc(dmy(b.due))}</td><td class="num">${inr(b.amount,2)}</td><td class="num">${inr(b.paid,2)}</td><td class="num"><b>${inr(b.balance,2)}</b></td><td>${pill(payLbl(b),{PENDING:b.late?'red':'orange',CLEARED:'green',CANCELLED:'gray'}[b.status])}</td></tr>`),'No bill');
ROUTES.bills={data:()=>api('GET',`/bills?${qs({status:UI.bst||'',late:UI.blate?1:'',q:UI.bq||''})}`),view:d=>{const rows=(d||{}).bills||[];
 return `${topbar('Vendor bills',`${rows.length} bills · balance ${inr(rows.filter(b=>b.status==='PENDING').reduce((s,b)=>s+b.balance,0))}`,STAFF&&routeOk('stockin')?`<button class="btn pri" data-go="stockin">${ic('truck')} Stock in</button>`:'')}
 <section class="card"><form class="row" data-form="bfilter" style="flex-wrap:wrap"><input class="inp" id="bq" value="${esc(UI.bq||'')}" placeholder="Vendor, bill no." style="flex:1;min-width:200px"><button class="btn">${ic('search')} Search</button>${exportBtn('bills',{status:UI.bst,q:UI.bq})}</form>
 <div class="chips">${[['','All'],['PENDING','To pay'],['late','Late'],['CLEARED','Cleared'],['CANCELLED','Cancelled']].map(([k,l])=>`<button class="chip ${(k==='late'?UI.blate:(!UI.blate&&(UI.bst||'')===k))?'on':''}" data-act="bf" data-f="${k}">${l}</button>`).join('')}</div>${billsTable(rows)}</section>`;}};
ROUTES.bill={data:()=>api('GET',`/bills/${UI.param}`),view:d=>{if(!d)return topbar('Vendor bill','Not found');const b=d.bill;
 return `${topbar(`${esc(b.no)} · ${esc(b.vendor_name)}`,`Bill ${esc(b.inv_no)} of ${esc(dmy(b.inv_date))} · due ${esc(dmy(b.due))} · entered by ${esc(b.by)}${b.posted?'':' · old bill (its stock was in the old site)'}`,`<button class="btn" data-go="bills">${ic('back')} Bills</button>`)}
 <div class="kpis">${kpi('Amount',inr(b.amount,2))}${kpi('Paid',inr(b.paid,2))}${kpi('Balance',inr(b.balance,2),b.late?'Late':'')}${kpi('Status',esc(payLbl(b)))}</div>
 ${card('Lines',table(['Part','HSN','GST','Qty','Rate','MRP','Total'],d.lines.map(l=>`<tr ${l.part?`class="click" data-act="part" data-id="${l.part}"`:''}><td><div class="cell2"><b>${esc(l.name)}</b><small class="mono">${esc(l.pno)}</small></div></td><td class="mono">${esc(l.hsn)}</td><td class="num">${l.gst} %</td><td class="num">${l.qty}</td><td class="num">${inr(l.rate,2)}</td><td class="num">${inr(l.mrp)}</td><td class="num"><b>${inr(l.amount,2)}</b></td></tr>`),'No lines'),`${PAYS&&b.status==='PENDING'?`<button class="btn pri" data-act="pay">${ic('wallet')} Pay</button>`:''}${BOSS&&b.status==='PENDING'&&!b.paid?`<button class="btn" data-act="bill-cancel">${ic('x')} Cancel bill</button>`:''}`)}
 ${card('Payments',table(['Day','Amount','Mode','Ref','By'],d.payments.map(p=>`<tr><td>${esc(dmy(p.day))}</td><td class="num"><b>${inr(p.amount,2)}</b></td><td>${esc(p.mode)}</td><td>${esc(p.ref)}</td><td>${esc(p.by)}</td></tr>`),'No payment yet'))}${b.notes?card('Note',`<p style="margin:0">${esc(b.notes)}</p>`):''}`;}};

// transfers
ROUTES.transfers={data:()=>api('GET','/transfers'),view:d=>{const rows=(d||{}).transfers||[];
 return `${topbar('Transfers DVG ⇄ RNR','Davanagere to Ranebennur takes stock out; Ranebennur to Davanagere adds it. The accountant panel gets every transfer.',BOSS&&!lockedS('BS')?`<button class="btn pri" data-act="tr-new">${ic('swap')} New transfer</button>`:'')}${liveBar('BS','A transfer changes stock, so it is made in the billing (Stock transfer) until switch day. The ones made here before stay in this list.')}
 ${card(`${rows.length} transfers`,table(['No.','Day','Direction','Part','Qty','MRP','Margin','Stock','By','Note'],rows.map(t=>`<tr ${t.part?`class="click" data-act="part" data-id="${t.part}"`:''}><td class="mono"><b>${esc(t.no)}</b></td><td>${esc(dmy(t.day))}</td><td>${pill(t.dir==='dvg-rnr'?'DVG → RNR':'RNR → DVG',t.dir==='dvg-rnr'?'violet':'teal')}${t.new_item?' '+pill('New part','yel'):''}</td><td><div class="cell2"><b>${esc(t.name)}</b><small class="mono">${esc(t.pno)}</small></div></td><td class="num"><b>${t.qty}</b></td><td class="num">${inr(t.mrp)}</td><td class="num">${t.margin} % · ${inr(t.profit,2)}</td><td class="num">${t.before} → ${t.after}</td><td>${esc(t.by)}</td><td><small>${esc(t.note)}</small></td></tr>`),'No transfer yet'),exportBtn('transfers'))}`;}};

// reports
ROUTES.reports={data:async()=>{const t=UI.tab||'brands';const p={brands:`/reports/brands?store=${UI.store}`,movers:`/reports/movers?${qs({store:UI.store,days:UI.days||30})}`,dead:`/parts?${qs({store:UI.store,f:'dead',sort:'mrp',size:200})}`,gst:`/reports/gst?store=${UI.store}`,dues:'/reports/dues'}[t];return {t,d:await api('GET',p)};},
 view:x=>{const t=x?x.t:'brands',d=(x&&x.d)||{};const tabs=[['brands','Stock by brand'],['movers','Fast movers'],['dead','Dead stock'],['gst','GST on stock'],...(PAYS?[['dues','Vendor dues by age']]:[])];
 let body='';
 if(t==='brands')body=table(['Brand','Parts','Pieces','Value at MRP',...(COST?['Value at cost']:[]),'Low'],(d.rows||[]).map(r=>`<tr><td><b>${esc(r.brand||'(no brand)')}</b></td><td class="num">${r.parts}</td><td class="num">${r.pcs}</td><td class="num">${inr(r.mrpv)}</td>${COST?`<td class="num">${inr(r.costv)}</td>`:''}<td class="num">${r.low||'—'}</td></tr>`));
 if(t==='movers')body=`<div class="chips">${[7,30,90,365].map(n=>`<button class="chip ${(UI.days||30)===n?'on':''}" data-act="days" data-n="${n}">${n} days</button>`).join('')}</div>`+table(['Part','Rack','Stock','Sold','Bills'],(d.rows||[]).map(r=>`<tr class="click" data-act="part" data-id="${r.id}"><td>${partCell(r)}</td><td class="mono">${esc(r.rack||'—')}</td><td class="num">${r.stock}</td><td class="num"><b>${r.qty}</b></td><td class="num">${r.bills}</td></tr>`));
 if(t==='dead')body=`<p class="muted" style="margin:0">In stock and no sale for 90 days (older than 90 days in the list). ${d.total||0} parts, value at MRP ${inr((d.rows||[]).reduce((s,p)=>s+p.stock*p.mrp,0))} for the top 200.</p>`+table(['Part','Rack','Stock','MRP','Last sale'],(d.rows||[]).map(p=>`<tr class="click" data-act="part" data-id="${p.id}"><td>${partCell(p)}</td><td class="mono">${esc(p.rack||'—')}</td><td class="num">${p.stock}</td><td class="num">${inr(p.mrp)}</td><td>${esc(dmy(p.lastSale))}</td></tr>`));
 if(t==='gst')body=table(['HSN','GST','Parts','Pieces','Taxable value','GST in it'],(d.rows||[]).map(r=>`<tr><td class="mono">${esc(r.hsn||'(none)')}</td><td class="num">${r.gst} %</td><td class="num">${r.parts}</td><td class="num">${r.pcs}</td><td class="num">${inr(r.taxable,2)}</td><td class="num">${inr(r.tax,2)}</td></tr>`));
 if(t==='dues')body=table(['Vendor','Opening','Not due yet','Late 1-30 days','Late 31-60','Late 60+'],(d.rows||[]).map(r=>`<tr class="click" data-act="vendor" data-id="${r.id}"><td><b>${esc(r.name)}</b></td><td class="num">${inr(r.opening)}</td><td class="num">${inr(r.notdue)}</td><td class="num">${inr(r.late30)}</td><td class="num">${inr(r.late60)}</td><td class="num"><b>${inr(r.late90)}</b></td></tr>`),'No dues');
 const csvKind={brands:'brands',dead:'parts',gst:'gst',movers:null,dues:null}[t];
 return `${topbar('Reports & sheets','Every list can be downloaded as CSV for Excel.',storeSeg())}
 <div class="subnav">${tabs.map(([k,l])=>`<button class="${t===k?'on':''}" data-act="tab" data-t="${k}">${l}</button>`).join('')}</div>${card(tabs.find(x=>x[0]===t)[1],body,csvKind?exportBtn(csvKind,csvKind==='parts'?{store:UI.store,f:'dead'}:{store:UI.store}):'')}
 ${card('Download sheets',`<div class="row" style="flex-wrap:wrap">${[['parts','Parts list'],['moves','Stock log'],['transfers','Transfers'],['bills','Vendor bills'],['orders','Order sheet today'],['reorder','Reorder list'],['gst','GST on stock'],['brands','Stock by brand']].map(([k,l])=>`<a class="btn" href="/api/export/${k}.csv?store=${UI.store}" download>${ic('download')} ${l}</a>`).join('')}</div>`)}`;}};

// settings
ROUTES.settings={data:async()=>({links:BOSS?await api('GET','/links'):null,acc:OWNER?await api('GET','/accounts'):null,audit:OWNER?await api('GET','/audit?limit=60'):null}),view:d=>{d=d||{};
 return `${topbar('Settings',`${esc(ME_U.name)} · ${esc(ME_U.roleLabel)}`)}
 <div class="grid g2e">${card('My PIN',`<form class="grid" data-form="pin" novalidate>${field('pold','Current PIN','',{type:'password',num:1})}${field('pnew','New 4-digit PIN','',{type:'password',num:1})}<button class="btn pri" style="align-self:flex-start">Change PIN</button></form>`)}
 ${card('Alerts on this device',`<p class="muted" style="margin:0">Low stock, rack checks, big stock cuts and vendor dues come on the bell. ${S.push?'Browser push can be switched on for this phone or computer.':'Browser push is off on this server (ONESIGNAL_APP_ID).'}</p>${S.push?`<button class="btn" data-act="push-on" style="align-self:flex-start">${ic('bell')} Get alerts on this device</button>`:''}`)}
 ${OWNER?card('Rules',`<form class="grid" data-form="settings" novalidate>${field('sgst','GST rates (%)',S.lists.gst.join(', '))}${field('sred','Stock cut above this value alerts the owner (₹)',S.settings.reduceAlert,{num:1})}${field('sphones','WhatsApp numbers for alerts and the 10 am summary',(S.settings.alertPhones||[]).join(', '),{ph:'98200 00111, 98450 00333'})}<button class="btn pri" style="align-self:flex-start">Save</button></form>`):''}
 ${d.links?card('Links to other portals',`<div class="list">${Object.entries(d.links.on).map(([k,on])=>{const l=d.links.last[k]||d.links.last[k+'Pull'];const w=(d.links.waiting.find(x=>x.target===k)||{}).n;return `<div class="between"><span class="cell2"><b>${esc({billingBS:'Bike Surgeon billing (parts and stock, read every few seconds)',billingML:'The Moto Lab billing (items and stock, read every few seconds)',accounts:'Accountant panel',admin:'Admin panel',desk:'Workshop desk (parts + stock)',motolab:'The Moto Lab (items)',whatsapp:'WhatsApp sender',push:'Browser push (OneSignal)'}[k]||k)}</b><small>${on?(l?`${l.ok?'OK':'Problem'} · ${esc(l.at)}${l.parts?` · ${Number(l.parts).toLocaleString('en-IN')} parts`:''}${l.error?' · '+esc(l.error):''}`:'Waiting for the first run'):'Off (no URL / key in .env)'}${w?` · ${w} waiting`:''}</small></span>${pill(on?'On':'Off',on?'green':'gray')}</div>`;}).join('')}</div>
 ${d.links.refused.length?`<b>Refused messages</b>${table(['When','To','Error',''],d.links.refused.map(r=>`<tr><td>${esc(r.created_at)}</td><td>${esc(r.target)} ${esc(r.path)}</td><td><small>${esc(r.last_error)}</small></td><td>${OWNER?`<button class="btn sm" data-act="retry" data-id="${r.id}">Send again</button>`:''}</td></tr>`))}`:''}`):''}</div>
 ${d.acc?card('Logins',table(['Name','Phone','Role','',''],d.acc.accounts.map(a=>`<tr><td><b>${esc(a.name)}</b></td><td class="mono">${esc(a.phone)}</td><td><select class="sel" data-act="acc-role" data-id="${a.id}" aria-label="Role">${Object.entries(d.acc.roles).map(([k,l])=>`<option value="${k}" ${a.role===k?'selected':''}>${esc(l)}</option>`).join('')}</select></td><td>${a.active?pill('On','green'):pill('Off','gray')}</td><td><span class="row"><button class="btn sm" data-act="acc-pin" data-id="${a.id}">New PIN</button>${a.id!==ME_U.id?`<button class="btn sm" data-act="acc-onoff" data-id="${a.id}" data-on="${a.active?0:1}">${a.active?'Switch off':'Switch on'}</button>`:''}</span></td></tr>`)),`<button class="btn pri" data-act="acc-new">${ic('plus')} New login</button>`):''}
 ${flowSettings()}
 ${d.audit?card('Change history',table(['When','Who','What','Detail'],d.audit.log.map(a=>`<tr><td class="mono" style="white-space:nowrap">${esc(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.action)}</td><td><small>${esc(a.detail)}</small></td></tr>`)),'','latest 60'):''}`;}};

// ---------------- Inventory 2.0 · Bike Pharma restock (server/flow.js)
// 1 accountant: vendors with bank details, dues, due-date changes with a reason, payment calendar · 2 billing (cashier): upload the vendor bill
// 3 supervisor: New stock, discount %, counters · 4 manager: selling price · 5 counter: shelf no. and into stock. Each person sees only their pages.
const FB=()=>S.flow||{badges:{},counters:{},brands:[]};
const R2=n=>Math.round((Number(n)||0)*100)/100;
const STAGE={nagaraj:['With supervisor','orange'],ganesh:['Waiting for price','blue'],counters:['At counters','violet'],done:['Inventory updated','green']};
const LST={pending:['Pending','orange'],assigned:['Assigned','blue'],priced:['Price updated','violet'],stocked:['Inventory updated','green']};
const PAYC={'Full paid':'green','Partial paid':'orange','Not paid':'red','Cancelled':'gray'};
const stagePill=s=>{const x=STAGE[s]||[s,'gray'];return pill(x[0],x[1]);};
const lstPill=s=>{const x=LST[s]||[s,'gray'];return pill(x[0],x[1]);};
const tatTag=t=>!t?'—':t.done?`<span class="tmr">${t.hours} h</span>`:`<span class="tmr ${t.late?'late':''}">${t.late?`${R2(-t.left)} h late`:`${t.left} h left`}</span>`;
const ctrOfB=b=>{const k=String(b||'').toUpperCase().replace(/[^A-Z]/g,'').replace(/^RE$/,'ROYALENFIELD');if(!k)return '';for(const [c,l] of Object.entries(FB().counters))if(l.some(x=>String(x).toUpperCase().replace(/[^A-Z]/g,'')===k))return c;return '';};
const ctrLabel=c=>`${c} · ${(FB().counters[c]||[]).join(' + ')}`;
const addDays=(day,n)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+(Number(n)||0));return d.toISOString().slice(0,10);};
const FLOW_OK={upload:UPL,myup:UPL,dues:PAYS,paycal:PAYS,newstock:BOSS||SUP,fbill:true,pricing:BOSS,counter:BOSS||SUP||CTR,tracker:BOSS};
const routeOk=r=>(r==='add'||r==='stockin')&&LV().on&&!freeStores().length?false:r in FLOW_OK?!!FLOW_OK[r]:(!NEWROLE||r==='settings');
const HOME=CASH?'upload':SUP?'newstock':CTR?'counter':'dash';
const subnav=(items,on,act)=>`<div class="subnav" role="tablist">${items.map(([k,l,n,cls])=>`<button class="${on===k?'on':''}" data-act="${act}" data-t="${esc(k)}" role="tab">${esc(l)}${n!=null?`<span class="sb ${cls||''}">${n}</span>`:''}</button>`).join('')}</div>`;

// ---- 1 · accountant: dues and payments
ROUTES.dues={data:async()=>{const [d,h]=await Promise.all([api('GET',`/flow/dues?${qs({show:UI.dshow||'open',vendor:UI.dv||''})}`),api('GET',`/flow/due-history?${qs({vendor:UI.dv||''})}`)]);return {...(d||{bills:[],kpi:{}}),hist:(h||{}).rows||[]};},
 view:d=>{const k=d.kpi||{};
 return `${topbar('Dues & payments','Stage 1 · Accountant · every vendor bill, its due date and how much is paid')}
 <div class="kpis">${kpi('Total due',inr(k.due))}${kpi('Due in 7 days',inr(k.week))}${kpi('Late',inr(k.late),k.lateBills?`${k.lateBills} bill${k.lateBills>1?'s':''}`:'')}</div>
 ${card('Vendor bills',`<div class="between" style="flex-wrap:wrap;gap:10px">${subnav([['open','Not fully paid'],['paid','Full paid'],['all','All']],UI.dshow||'open','dshow')}
  <select class="sel" data-act="dv" aria-label="Vendor" style="max-width:260px"><option value="">All vendors</option>${S.lists.vendors.map(v=>`<option value="${v.id}" ${String(UI.dv)===String(v.id)?'selected':''}>${esc(v.name)}</option>`).join('')}</select></div>
  ${table(['Vendor','Bill','Bill date','Due date','Amount','Paid','Balance','Status',''],d.bills.map(b=>`<tr><td><div class="cell2"><b>${esc(b.vendor_name)}</b><small>${esc(b.vendor_days)} credit days</small></div></td>
   <td><div class="cell2"><b class="mono">${esc(b.inv_no)}</b><small class="mono">${esc(b.no)}</small></div></td><td>${esc(dmy(b.inv_date))}</td>
   <td><div class="cell2"><b class="${b.late?'latetag':''}">${esc(dmy(b.due))}</b><small>${b.late?'Late':''}${b.edits?`${b.late?' · ':''}changed ${b.edits}×`:''}</small></div></td>
   <td class="num">${inr(b.amount,2)}</td><td class="num">${inr(b.paid,2)}</td><td class="num"><b>${inr(b.balance,2)}</b></td><td>${pill(b.pay,PAYC[b.pay]||'gray')}</td>
   <td><span class="row" style="flex-wrap:nowrap">${b.status==='PENDING'?`<button class="btn sm pri" data-act="fpay" data-id="${b.id}">Pay</button><button class="btn sm" data-act="fdue" data-id="${b.id}">${ic('cal')} Due date</button>`:''}<button class="btn sm" data-act="bill" data-id="${b.id}" aria-label="Open">${ic('chev')}</button></span></td></tr>`),'No bills here')}`)}
 ${card('Due date changes',table(['When','Vendor · bill','Old → new','Reason','By'],d.hist.slice(0,40).map(h=>`<tr><td class="mono" style="white-space:nowrap">${esc(h.at)}</td><td>${esc(h.vendor_name)} · <span class="mono">${esc(h.inv_no)}</span></td><td style="white-space:nowrap">${esc(dmy(h.old))} → <b>${esc(dmy(h.new))}</b></td><td><small>${esc(h.why)}</small></td><td>${esc(h.by)}</td></tr>`),'No due date changed yet'),'','every change is kept')}`;}};

// ---- 1 · accountant: payment calendar
ROUTES.paycal={data:()=>api('GET',`/flow/calendar?${qs({month:UI.cm||''})}`),view:d=>{d=d||{month:S.clock.today.slice(0,7),bills:[],late:[],paid:[]};
 const [y,m]=d.month.split('-').map(Number),days=new Date(Date.UTC(y,m,0)).getUTCDate(),first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;
 const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const mv=n=>{const t=new Date(Date.UTC(y,m-1+n,1));return t.toISOString().slice(0,7);};
 const dayOf=i=>`${d.month}-${String(i).padStart(2,'0')}`;
 const sel=UI.cday&&UI.cday.startsWith(d.month)?UI.cday:null;
 const cells=[...Array(first)].map(()=>'<div class="cal-c empty"></div>').concat([...Array(days)].map((_,i)=>{const day=dayOf(i+1);const due=d.bills.filter(b=>b.due===day),pd=d.paid.find(p=>p.day===day);
  return `<button class="cal-c ${day===S.clock.today?'today':''} ${sel===day?'on':''}" data-act="cday" data-d="${day}"><b>${i+1}</b>${due.length?`<span class="cal-i ${day<S.clock.today?'over':'due'}">${due.length} due · ${inr(due.reduce((s,b)=>s+b.balance,0))}</span>`:''}${pd?`<span class="cal-i paid">Paid ${inr(pd.amount)}</span>`:''}</button>`;}));
 const list=sel?d.bills.filter(b=>b.due===sel):d.bills;
 const rows=bs=>table(['Due','Vendor','Bill','Balance','Status',''],bs.map(b=>`<tr><td class="${b.late?'latetag':''}">${esc(dmy(b.due))}</td><td><b>${esc(b.vendor_name)}</b></td><td class="mono">${esc(b.inv_no)}</td><td class="num"><b>${inr(b.balance,2)}</b></td><td>${pill(b.pay,PAYC[b.pay]||'gray')}</td><td><span class="row" style="flex-wrap:nowrap"><button class="btn sm pri" data-act="fpay" data-id="${b.id}">Pay</button><button class="btn sm" data-act="fdue" data-id="${b.id}">${ic('cal')} Due date</button></span></td></tr>`),'Nothing due');
 UI.calRows=[...d.bills,...d.late];
 return `${topbar('Payment calendar',`${MON[m-1]} ${y} · due ${inr(d.bills.reduce((s,b)=>s+b.balance,0))} · paid ${inr(d.paid.reduce((s,p)=>s+p.amount,0))}`)}
 ${card(`${MON[m-1]} ${y}`,`<div class="cal"><div class="cal-h">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div><div class="cal-g">${cells.join('')}</div>
  <div class="row muted" style="font-size:12px;gap:14px"><span><span class="cal-i due">Due</span></span><span><span class="cal-i over">Due, date passed</span></span><span><span class="cal-i paid">Paid that day</span></span></div></div>`,
  `<button class="btn sm" data-act="cm" data-m="${mv(-1)}" aria-label="Last month">${ic('back')}</button><button class="btn sm" data-act="cm" data-m="">Today</button><button class="btn sm" data-act="cm" data-m="${mv(1)}" aria-label="Next month">${ic('chev')}</button>`)}
 ${card(sel?`Due on ${esc(dmy(sel))}`:`Due in ${MON[m-1]}`,rows(list),sel?'<button class="btn sm" data-act="cday" data-d="">Whole month</button>':'')}
 ${d.late.length?card('Late (due date passed)',rows(d.late),'',`${d.late.length} bills · ${inr(d.late.reduce((s,b)=>s+b.balance,0))}`):''}`;}};

// ---- 2 · cashier: upload the vendor bill
const FU={gstin:'',vendor:'',invNo:'',invDate:'',amount:'',notes:'',lines:[],readId:null,readMsg:'',reading:false,dup:false,files:0};
function keepFu(){if(!document.getElementById('fuv'))return;FU.vendor=val('fuv');FU.invNo=val('funo');FU.invDate=val('fudate');FU.amount=val('fuamt');FU.notes=val('funote');}
const fuTotal=()=>R2(FU.lines.reduce((s,l)=>s+num(l.qty)*num(l.rate)*(1+num(l.gst)/100),0));
ROUTES.upload={view:()=>{const v=S.lists.vendors.find(x=>String(x.id)===String(FU.vendor));const day=FU.invDate||S.clock.today;
 const lockMrp=l=>CASH&&(l.mrpFrom==='bill'||l.mrpFrom==='list');
 // Sam 6 Nov: a box the cashier must fill is orange, with what to type (MRP not on the bill, no real item name)
 const fuNeed=l=>{const k=x=>String(x||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return {name:!!l.pno&&(!String(l.name||'').trim()||k(l.name)===k(l.pno)),mrp:!!l.pno&&!(num(l.mrp)>0)&&!lockMrp(l)};};
 const fuMark=i=>{const l=FU.lines[i];if(!l)return;const n=fuNeed(l);for(const k of ['name','mrp']){const el=document.getElementById(`fu-${i}-${k}`),w=document.getElementById(`fuw-${i}-${k}`);if(el)el.classList.toggle('need',n[k]);if(w)w.hidden=!n[k];}};
 const line=(l,i)=>{const nd=fuNeed(l);return `<div class="frow"><div class="fcell fwide"><span class="fl">Part no. · description</span><input class="inp mono" value="${esc(l.pno)}" id="fu-${i}-pno" data-act="fu-l" data-i="${i}" data-k="pno" placeholder="Part no." aria-label="Part no."><input class="inp ${nd.name?'need':''}" value="${esc(l.name)}" id="fu-${i}-name" data-act="fu-l" data-i="${i}" data-k="name" placeholder="Description" aria-label="Description"><small class="fneed" id="fuw-${i}-name" ${nd.name?'':'hidden'}>Type the item name, e.g. Exide battery XLTZ4A</small>${l.pno?`<small class="muted">${l.inList?'In the parts list':'New part (added with stock 0)'}</small>`:''}</div>
  <label class="fcell"><span class="fl">Brand</span><input class="inp" list="dlbr" value="${esc(l.brand)}" id="fu-${i}-brand" data-act="fu-l" data-i="${i}" data-k="brand"></label>
  <label class="fcell"><span class="fl">Qty</span><input class="inp num" inputmode="numeric" value="${esc(l.qty)}" id="fu-${i}-qty" data-act="fu-l" data-i="${i}" data-k="qty"></label>
  <label class="fcell"><span class="fl">Rate (₹, no GST)</span><input class="inp num" inputmode="decimal" value="${esc(l.rate)}" id="fu-${i}-rate" data-act="fu-l" data-i="${i}" data-k="rate"></label>
  <label class="fcell"><span class="fl">GST %</span><select class="sel" id="fu-${i}-gst" data-act="fu-l" data-i="${i}" data-k="gst">${S.lists.gst.map(g=>`<option ${Number(l.gst)===g?'selected':''}>${g}</option>`).join('')}</select></label>
  <label class="fcell"><span class="fl">MRP (₹) ${lockMrp(l)?ic('lock','i sm'):''}</span><input class="inp num ${nd.mrp?'need':''}" inputmode="decimal" value="${esc(l.mrp||'')}" id="fu-${i}-mrp" data-act="fu-l" data-i="${i}" data-k="mrp" ${lockMrp(l)?'readonly title="MRP comes from the bill / parts list and cannot be changed"':''}><small class="fneed" id="fuw-${i}-mrp" ${nd.mrp?'':'hidden'}>MRP not on the bill. Type it.</small></label>
  <div class="fcell"><span class="fl">Amount</span><b class="num">${inr(num(l.qty)*num(l.rate)*(1+num(l.gst)/100),2)}</b></div>
  <button type="button" class="btn sm" data-act="fu-del" data-i="${i}" aria-label="Remove line">${ic('x')}</button></div>`;};
 return `${topbar('Upload vendor bill','Stage 2 · Billing · the bill goes to the Supervisor (New stock)')}
 ${card('1 · Bill photo or PDF',`<label class="newinv" style="cursor:pointer">${ic('upload')}<span>${FU.reading?'Reading the bill…':FU.files?`${FU.files} file${FU.files>1?'s':''} read · pick again to read another bill`:'Take a photo or pick the PDF (up to 6 pages)'}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple data-act="fu-file" hidden ${FU.reading?'disabled':''}></label>
  <small class="muted">The photo is only read, never saved. Check every line after reading: you can change part no., description, qty, rate and GST. MRP from the bill cannot be changed.</small>${FU.readMsg?`<b style="color:var(--orangeT)">${esc(FU.readMsg)}</b>`:''}`)}
 ${card('2 · Vendor and bill',`${grid(200,[field('fuv','Vendor *',FU.vendor,{type:'select',opts:[['','Pick the vendor'],...S.lists.vendors.filter(x=>x.active).map(x=>[x.id,x.name])]}),field('funo','Vendor bill no. *',FU.invNo),field('fudate','Bill date *',day,{type:'date'}),field('fuamt','Bill total (₹)',FU.amount,{num:1,ph:String(Math.round(fuTotal())||'')})].join(''))}
  <div class="row" style="gap:18px;flex-wrap:wrap"><span class="cell2"><small class="muted">Credit days</small><b>${v?v.days:'—'}</b></span><span class="cell2"><small class="muted">Due date (bill date + credit days)</small><b>${v?esc(dmy(addDays(day,v.days))):'—'}</b>${v?'':'<small class="muted">shown after you pick the vendor</small>'}</span>${v?`<span class="cell2"><small class="muted">Vendor GSTIN · phone</small><b class="mono">${esc(v.gstin||'—')} · ${esc(v.phone||'—')}</b></span>`:''}</div>${v&&FU.gstin&&v.gstin&&FU.gstin!==v.gstin?`<b style="color:var(--orangeT)">The bill's GSTIN ${esc(FU.gstin)} is not this vendor's GSTIN. Check the vendor.</b>`:''}${field('funote','Note','',{ph:'Anything the accountant should know'})}`)}
 ${card(`3 · Items · ${FU.lines.length}`,`<datalist id="dlbr">${FB().brands.map(b=>`<option value="${esc(b)}">`).join('')}</datalist>${FU.lines.map(line).join('')||'<div class="empty">Read the bill above, or add the lines by hand.</div>'}
  <div class="between" style="flex-wrap:wrap;gap:10px"><button type="button" class="btn" data-act="fu-add">${ic('plus')} Add line</button><span>Lines total <b class="num">${inr(fuTotal(),2)}</b></span></div>${num(FU.amount)&&FU.lines.length&&Math.abs(num(FU.amount)-fuTotal())>1?`<b style="color:var(--orangeT)">Bill total ${inr(num(FU.amount),2)} and lines total ${inr(fuTotal(),2)} differ by ${inr(Math.abs(num(FU.amount)-fuTotal()),2)}. Check the lines.</b>`:''}`)}
 ${FU.dup?`<label class="row" style="font-weight:600"><input type="checkbox" id="fudup"> This is a different bill with the same number</label>`:''}
 <div class="row"><button class="btn pri" data-act="fu-send" style="padding:12px 22px">${ic('check')} Send to Supervisor</button><button class="btn" data-act="fu-clear">Clear</button></div>`;}};
async function fuFiles(input){const files=[...input.files];if(!files.length)return;keepFu();
 if(files.length>6){toast('Up to 6 pages at a time');return;}
 for(const f of files)if(f.size>8*1024*1024){toast(`${f.name} is bigger than 8 MB`);return;}
 FU.reading=true;FU.readMsg='';render();
 const data=await Promise.all(files.map(f=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f);})));
 const d=await api('POST','/flow/read',{files:data});FU.reading=false;
 if(!d){render();return;}
 if(!d.ok){FU.readMsg=d.reason;if(!FU.lines.length)FU.lines.push({pno:'',name:'',brand:'',qty:1,rate:'',gst:18,mrp:''});render();return;}
 FU.files=files.length;FU.readId=d.readId;FU.lines=d.lines;FU.readMsg=d.lines.length?'':'No lines found on the bill. Type them.';
 FU.gstin=d.gstin||'';if(d.gstin&&!FU.vendor){const m=S.lists.vendors.find(x=>x.active&&x.gstin===d.gstin);if(m)FU.vendor=String(m.id);}if(d.no)FU.invNo=d.no;if(/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))FU.invDate=d.date;if(d.total)FU.amount=d.total;
 toast(`${d.lines.length} lines read. Check them.`);render();}
async function fuLook(i){const l=FU.lines[i];const d=await api('POST','/flow/look',{lines:[{pno:l.pno,name:l.name,brand:l.brand,qty:l.qty,rate:l.rate,gst:l.gst,mrp:l.mrpFrom==='bill'?l.mrp:0}]});
 if(!d||!d.lines[0])return;const x=d.lines[0];Object.assign(l,{part:x.part,inList:x.inList,name:l.name||x.name,brand:l.brand||x.brand,hsn:x.hsn,mrp:l.mrpFrom==='bill'?l.mrp:x.mrp||l.mrp,mrpFrom:l.mrpFrom==='bill'?'bill':x.mrpFrom});render();}
async function fuSend(){keepFu();
 if(!FU.vendor){toast('Pick the vendor');return;}if(!FU.invNo){toast("Type the vendor's bill number");return;}if(!FU.lines.length){toast('Add the items of the bill');return;}
 {const diff=Math.abs(num(FU.amount)-fuTotal());if(num(FU.amount)&&diff>1&&!confirmBox(`Bill total and lines total differ by ${inr(diff,2)}. Send anyway?`))return;}
 const body={vendor:+FU.vendor,invNo:FU.invNo,invDate:FU.invDate||S.clock.today,amount:num(FU.amount)||undefined,notes:FU.notes,readId:FU.readId||undefined,dupOk:!!val('fudup'),
  lines:FU.lines.map(l=>({part:l.part||undefined,pno:l.pno,name:l.name,brand:l.brand,hsn:l.hsn,qty:num(l.qty),rate:num(l.rate),gst:num(l.gst),mrp:num(l.mrp)}))};
 const d=await api('POST','/flow/upload',body);
 if(!d){if(LASTERR&&LASTERR.dup){FU.dup=true;render();}return;}
 toast(d.msg);Object.assign(FU,{gstin:'',vendor:'',invNo:'',invDate:'',amount:'',notes:'',lines:[],readId:null,readMsg:'',dup:false,files:0});await refreshState();go('myup');}

ROUTES.myup={data:()=>api('GET','/flow/uploads'),view:d=>{const rows=(d||{}).rows||[];
 return `${topbar(CASH?'My uploads':'Uploaded vendor bills','Bike Pharma bills and where each one is now',`<button class="btn pri" data-go="upload">${ic('upload')} Upload bill</button>`)}
 ${card('Bills',table(['Bill','Vendor','Bill date','Items','Amount','Now','Uploaded'],rows.map(b=>`<tr class="click" data-act="fbill" data-id="${b.id}"><td><div class="cell2"><b class="mono">${esc(b.inv_no)}</b><small class="mono">${esc(b.no)}</small></div></td><td>${esc(b.vendor_name)}</td><td>${esc(dmy(b.inv_date))}</td><td class="num">${b.items}</td><td class="num">${inr(b.amount)}</td><td>${stagePill(b.stage)}</td><td class="mono" style="white-space:nowrap">${esc(b.at)}</td></tr>`),'No bill uploaded yet'))}`;}};

// ---- 3 · supervisor: New stock
ROUTES.newstock={data:()=>api('GET',`/flow/new-stock?${qs({tab:UI.nst||'Pending'})}`),view:d=>{d=d||{tab:'Pending',counts:{},rows:[]};
 return `${topbar('New stock',`Stage 3 · Supervisor · check the discount and give each item to its counter · ${FB().tatHours||24} h time`)}
 ${subnav(Object.keys(d.counts).map(k=>[k,k,d.counts[k],k==='Pending'&&d.counts[k]?'blink':'']),d.tab,'nst')}
 ${card(d.tab,table(['Bill','Bill date','Items','Brands','Progress','Time',''],d.rows.map(b=>`<tr class="click" data-act="fbill" data-id="${b.id}"><td><div class="cell2"><b>${esc(b.vendor)}</b><small class="mono">${esc(b.invNo)} · ${esc(b.no)}</small></div></td><td>${esc(dmy(b.invDate))}</td><td class="num">${b.items}</td><td><small>${esc(b.brands.join(', ')||'—')}</small></td>
  <td><small>${[b.pending&&`${b.pending} pending`,b.assigned&&`${b.assigned} assigned`,b.priced&&`${b.priced} priced`,b.stocked&&`${b.stocked} in stock`].filter(Boolean).join(' · ')}</small></td><td>${b.status==='Inventory updated'?pill('Done','green'):tatTag(b.tat)}</td><td>${ic('chev')}</td></tr>`),d.tab==='Pending'?'No new stock waiting':'Nothing here'))}`;}};

// ---- the bill of the flow: supervisor assigns here; others see where it is
ROUTES.fbill={data:()=>api('GET',`/flow/bills/${UI.param}`),view:d=>{if(!d)return topbar('Vendor bill','Not found');const b=d.bill;const canAsg=(BOSS||SUP)&&b.stage!=='done';
 const ctrs=Object.keys(d.counters);
 const ro=l=>`<div class="frow"><div class="fcell fwide"><b>${esc(l.name)}</b><small class="mono">${esc(l.pno)}</small></div><div class="fcell"><span class="fl">Brand</span>${esc(l.brand||'—')}</div><div class="fcell"><span class="fl">Counter</span>${esc(l.ctr||'—')}</div><div class="fcell"><span class="fl">Qty</span><b class="num">${l.qty}</b></div><div class="fcell"><span class="fl">MRP</span>${inr(l.mrp,2)}</div>
  ${l.disc!=null?`<div class="fcell"><span class="fl">Purchase disc.</span>${l.disc} %</div>`:''}${l.rate!=null?`<div class="fcell"><span class="fl">Rate</span>${inr(l.rate,2)}</div>`:''}${l.sell?`<div class="fcell"><span class="fl">Selling</span>${inr(l.sell,2)}</div>`:''}<div class="fcell"><span class="fl">Status</span>${lstPill(l.st)}${l.shelf?`<small>Shelf ${esc(l.shelf)}</small>`:''}</div></div>`;
 const ed=l=>l.st==='stocked'?ro(l):`<div class="frow"><label class="fcell fck"><input type="checkbox" data-asel="${l.id}" ${l.st==='pending'?'checked':''} aria-label="Pick ${esc(l.name)}"></label><div class="fcell fwide"><b>${esc(l.name)}</b><small class="mono">${esc(l.pno)} · qty ${l.qty} · MRP ${inr(l.mrp,2)}</small></div>
  <label class="fcell"><span class="fl">Brand</span><select class="sel" id="ab-${l.id}" data-act="ab" data-id="${l.id}"><option value="">Pick</option>${[...new Set([...d.brands,...(l.brand?[l.brand]:[])])].map(x=>`<option ${x===l.brand?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
  <label class="fcell"><span class="fl">Counter</span><select class="sel" id="ac-${l.id}"><option value="">Pick</option>${ctrs.map(c=>`<option value="${c}" ${c===l.ctr?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
  <label class="fcell"><span class="fl">Purchase disc. %</span><input class="inp num" id="ad-${l.id}" inputmode="decimal" value="${l.disc??''}">${l.discBill!=null&&l.discBill!==l.disc?`<small class="muted">bill says ${l.discBill} %</small>`:''}</label>
  ${BOSS?`<div class="fcell"><span class="fl">Cost (with GST)</span>${inr(l.cost,2)}</div>`:''}<div class="fcell"><span class="fl">Status</span>${lstPill(l.st)}</div></div>`;
 return `${topbar(`${esc(b.vendor)} · ${esc(b.invNo)}`,`${esc(b.no)} · bill date ${esc(dmy(b.invDate))} · uploaded by ${esc(b.by)} · ${esc(b.readNote||'')}`,`${stagePill(b.stage)} ${tatTag(d.tat)}`)}
 ${b.amount!=null?`<div class="kpis">${kpi('Bill amount',inr(b.amount,2))}${kpi('Due date',esc(dmy(b.due)))}${kpi('Items',d.lines.length)}</div>`:''}
 ${canAsg?card('Check and assign',`<small class="muted">Discount is % off MRP (never in ₹). Changing it tells the accountant. The counter comes from the brand.</small>${d.lines.map(ed).join('')}
  <div class="row"><button class="btn pri" data-act="asg" data-id="${b.id}">${ic('check')} Assign picked items</button><span class="muted">The Manager sees a popup and adds the selling price.</span></div>`):card('Items',d.lines.map(ro).join('')||'<div class="empty">No items for you on this bill</div>')}
 ${BOSS&&b.stage==='ganesh'?`<div class="row"><button class="btn pri" data-go="pricing">${ic('tag')} Set selling price</button></div>`:''}`;}};

// ---- 4 · manager: selling price
ROUTES.pricing={data:()=>api('GET',`/flow/pricing?${qs({tab:UI.pt||''})}`),view:d=>{d=d||{tab:'waiting',rows:[],waiting:0,doneToday:0};const wait=d.tab==='waiting';
 const row=l=>{const max=l.cost>0?Math.floor((l.mrp/l.cost-1)*10000)/100:0;return `<div class="frow" data-prow="${l.id}"><label class="fcell fck">${wait?`<input type="checkbox" data-psel="${l.id}" aria-label="Pick ${esc(l.name)}">`:''}</label>
  <div class="fcell fwide"><b>${esc(l.name)}</b><small class="mono">${esc(l.pno)} · ${esc(l.brand)} · ${esc(l.ctr)} · qty ${l.qty}</small><small>${esc(l.vendor)} ${esc(l.invNo)}</small></div>
  <div class="fcell"><span class="fl">MRP</span><b class="num">${inr(l.mrp,2)}</b></div><div class="fcell"><span class="fl">Purchase</span><b class="num">${inr(l.cost,2)}</b><small class="muted">${l.disc} % off MRP</small></div>
  <label class="fcell"><span class="fl">Selling % on purchase</span><input class="inp num" id="pp-${l.id}" data-pr="${l.id}" data-cost="${l.cost}" data-mrp="${l.mrp}" inputmode="decimal" value="${l.sellPct??''}" placeholder="max ${max}" ${wait?'':'readonly'}></label>
  <div class="fcell"><span class="fl">Selling ₹ · margin</span><b class="num" id="ps-${l.id}">${l.sell?inr(l.sell,2):'—'}</b><small id="pm-${l.id}" class="muted">${l.sell?`+${inr(l.sell-l.cost,2)}`:''}</small></div>
  ${[['pu','Customer %','dUser'],['pmc','Mechanic %','dMech'],['pw','Wholesaler %','dWhole']].map(([k,t,f])=>`<label class="fcell"><span class="fl">${t}</span><input class="inp num" id="${k}-${l.id}" data-pr="${l.id}" inputmode="decimal" value="${l[f]??''}" placeholder="0" ${wait?'':'readonly'}></label>`).join('')}
  <div class="fcell"><span class="fl">${wait?'Time':'Priced'}</span>${wait?tatTag(l.tat):`<small>${esc(l.prBy||'')} ${esc((l.prAt||'').slice(11,16))}</small>`}<label class="row" style="font-size:11.5px;font-weight:600" ${wait?'':'hidden'}><input type="checkbox" id="pl-${l.id}"> Sell below cost</label></div>
  <small class="fwarn" id="pwn-${l.id}"></small></div>`;};
 return `${topbar('New stock · selling price','Stage 4 · Manager · selling price = purchase + selling %, never above MRP · discounts are % off the selling price')}
 ${subnav([['waiting','Waiting',d.waiting,d.waiting?'blink':''],['done','Priced today',d.doneToday]],d.tab,'pt')}
 ${card(wait?'Waiting for price':'Priced today',d.rows.map(row).join('')||`<div class="empty">${wait?'Nothing waiting for a price':'Nothing priced today'}</div>`)}
 ${wait&&d.rows.length?`<div class="row"><button class="btn pri" data-act="price" style="padding:12px 22px">${ic('check')} Update picked items</button><span class="muted">Counters can put them into stock after this.</span></div>`:''}`;}};
function priceLive(id){const p=document.getElementById('pp-'+id);if(!p)return;const cost=+p.dataset.cost,mrp=+p.dataset.mrp,pct=p.value.trim()===''?null:num(p.value);
 const out=document.getElementById('ps-'+id),mg=document.getElementById('pm-'+id),wn=document.getElementById('pwn-'+id);const ck=document.querySelector(`[data-psel="${id}"]`);
 if(pct==null){out.textContent='—';mg.textContent='';wn.textContent='';return;}
 const sell=R2(cost*(1+pct/100));out.textContent=inr(sell,2);mg.textContent=`+${inr(sell-cost,2)}`;if(ck)ck.checked=true;
 const big=Math.max(...['pu','pmc','pw'].map(k=>num(val(`${k}-${id}`))));const low=R2(sell*(1-big/100));
 wn.textContent=sell>mrp+0.005?`Above MRP ${inr(mrp,2)}. Lower the selling %.`:low<cost-0.005?`After ${big} % discount the price ${inr(low,2)} is below purchase ${inr(cost,2)}.`:'';}

// ---- 5 · counter: put into stock with the shelf no.
ROUTES.counter={data:()=>api('GET',`/flow/counter?${qs({ctr:CTR?'':UI.ctr||'C1',brand:UI.cb||''})}`),view:d=>{d=d||{ctr:'',brands:[],rows:[]};const can=BOSS||CTR;
 const waitN=d.rows.filter(l=>l.st==='priced').length;
 const row=l=>`<div class="frow ${l.st==='stocked'?'fdone':''}"><div class="fcell fwide"><b>${esc(l.name)}</b><small class="mono">${esc(l.pno)} · ${esc(l.brand)}</small><small>${esc(l.vendor)} ${esc(l.invNo)}</small></div>
  <div class="fcell"><span class="fl">Qty</span><b class="num">${l.qty}</b></div><div class="fcell"><span class="fl">MRP</span>${inr(l.mrp,2)}</div><div class="fcell"><span class="fl">Selling</span>${l.sell?inr(l.sell,2):pill('No price yet','orange')}</div>
  ${l.st==='stocked'?`<div class="fcell"><span class="fl">Shelf</span><b>${esc(l.shelf)}</b></div><div class="fcell">${lstPill('stocked')}<small>${esc(l.skBy||'')}</small></div>`:
  `<label class="fcell"><span class="fl">Shelf no.</span><input class="inp mono" id="sh-${l.id}" value="${esc(l.shelf||l.rack||'')}" placeholder="A-12" autocapitalize="characters"></label><div class="fcell">${can?`<button class="btn ${l.st==='priced'?'pri':''}" data-act="stk" data-id="${l.id}" data-st="${l.st}" data-n="${esc(l.name)}">${l.st==='priced'?ic('check')+' Submit':ic('lock')+' Submit'}</button>`:lstPill(l.st)}</div>`}</div>`;
 return `${topbar(CTR?`My counter · ${esc(d.ctr)}`:'Counters',`Stage 5 · Counter · ${esc((d.brands||[]).join(' + '))} · check the item, type the shelf no., submit to stock`,CTR?'':`<div class="seg" role="group" aria-label="Counter">${Object.keys(FB().counters).map(c=>`<button class="${d.ctr===c?'on':''}" data-act="ctr" data-c="${c}">${c}</button>`).join('')}</div>`)}
 <div class="row" style="flex-wrap:wrap;gap:6px"><button class="chip ${!UI.cb?'on':''}" data-act="cb" data-b="">All brands</button>${(d.brands||[]).map(b=>`<button class="chip ${UI.cb===b?'on':''}" data-act="cb" data-b="${esc(b)}">${esc(b)}</button>`).join('')}</div>
 ${card(`Items · ${waitN} ready`,d.rows.map(row).join('')||'<div class="empty">No new items for this counter</div>','','items without a selling price cannot go into stock')}`;}};

// ---- admin: where every bill is
ROUTES.tracker={data:()=>api('GET','/flow/tracker'),view:d=>{d=d||{rows:[],kpi:{}};const k=d.kpi;
 return `${topbar('Restock tracker',`Bike Pharma · ${FB().tatHours||24} h for the Supervisor, then ${FB().tatHours||24} h for the Manager`)}
 <div class="kpis">${kpi('With Supervisor',k.nagaraj||0,'','newstock')}${kpi('With Manager',k.ganesh||0,'','pricing')}${kpi('At counters',k.counters||0)}${kpi('Late',k.late||0)}</div>
 ${card('Bills (open + last 7 days)',table(['Bill','Uploaded','Supervisor','Manager','Counters','Total','Now'],d.rows.map(r=>`<tr class="click" data-act="fbill" data-id="${r.id}"><td><div class="cell2"><b>${esc(r.vendor)}</b><small class="mono">${esc(r.invNo)} · ${esc(r.no)}</small></div></td><td><div class="cell2"><span>${esc(r.by)}</span><small class="mono">${esc(r.sentAt)}</small></div></td>
  <td>${tatTag(r.nagaraj)}</td><td>${r.ganesh?tatTag(r.ganesh):'—'}</td><td>${r.counters.done?pill('Done','green'):r.stage==='counters'?`${r.counters.s||0} / ${r.counters.n}`:'—'}</td><td class="num">${R2(r.total)} h</td><td>${stagePill(r.stage)}</td></tr>`),'No restock bill yet'))}`;}};

// ---- overlays, clicks and forms of the flow (called from the shared handlers)
function flowOverlay(){
 if(OV.t==='fdue'){const b=OV.b;return modal(`Change due date · ${esc(b.inv_no)}`,`<span class="muted">${esc(b.vendor_name)} · balance ${inr(b.balance,2)} · now due ${esc(dmy(b.due))}</span>${field('fdnew','New due date *',b.due,{type:'date'})}${field('fdwhy','Reason *','',{type:'area',rows:2,ph:'Vendor gave 15 more days on call'})}
  <button class="btn pri" style="padding:12px">Save new date</button>${OV.hist&&OV.hist.length?`<b>Earlier changes</b>${OV.hist.map(h=>`<small>${esc(h.at)} · ${esc(dmy(h.old))} → ${esc(dmy(h.new))} · ${esc(h.by)}: ${esc(h.why)}</small>`).join('')}`:''}`,'fdue');}
 if(OV.t==='cmgr')return `<div class="scrim" data-act="close-ov"><div class="modal" data-stop role="alertdialog" aria-label="Contact your manager" style="text-align:center;align-items:center"><span class="avatar p-orange" style="width:56px;height:56px">${ic('lock')}</span><h2 style="font-size:20px">Contact your manager</h2><p class="muted" style="margin:0">${esc(OV.name)} has no selling price yet. It cannot go into stock or be sold until the manager sets the price.</p><button class="btn pri" data-act="close-ov" style="padding:12px 28px">OK</button></div></div>`;
 return '';}
async function flowClick(a,t,id){
 switch(a){
  case 'dshow':UI.dshow=t.dataset.t;await load();return true;
  case 'fpay':{const b=(DATA.bills||UI.calRows||[]).find(x=>x.id===+id)||(UI.calRows||[]).find(x=>x.id===+id);if(b){OV={t:'pay',b:{id:b.id,no:b.inv_no,balance:b.balance,bank:{acc_name:b.acc_name,acc_no:b.acc_no,ifsc:b.ifsc,bank_name:b.bank_name,branch:b.branch,upi:b.vendor_upi}}};render();}return true;}
  case 'fdue':{const b=(DATA.bills||[]).find(x=>x.id===+id)||(UI.calRows||[]).find(x=>x.id===+id);if(!b)return true;const h=await api('GET',`/flow/due-history?bill=${b.id}`);OV={t:'fdue',b,hist:(h||{}).rows||[]};render();return true;}
  case 'cm':UI.cm=t.dataset.m;UI.cday='';await load();return true;
  case 'cday':UI.cday=t.dataset.d;render();return true;
  case 'fu-add':keepFu();FU.lines.push({pno:'',name:'',brand:'',qty:1,rate:'',gst:18,mrp:''});render();return true;
  case 'fu-del':keepFu();FU.lines.splice(+t.dataset.i,1);render();return true;
  case 'fu-send':fuSend();return true;
  case 'fu-clear':if(confirmBox('Clear this bill and start again?')){Object.assign(FU,{gstin:'',vendor:'',invNo:'',invDate:'',amount:'',notes:'',lines:[],readId:null,readMsg:'',dup:false,files:0});render();}return true;
  case 'fbill':go('fbill',id);return true;
  case 'nst':UI.nst=t.dataset.t;await load();return true;
  case 'asg':{const ids=[...document.querySelectorAll('[data-asel]:checked')].map(x=>+x.dataset.asel);if(!ids.length){toast('Tick the items to assign');return true;}
   const lines=ids.map(i=>({id:i,brand:val('ab-'+i),ctr:val('ac-'+i),disc:val('ad-'+i)===''?undefined:num(val('ad-'+i))}));
   const miss=lines.find(l=>!l.brand||!l.ctr);if(miss){toast('Every picked item needs a brand and a counter');return true;}
   act('POST',`/flow/bills/${id}/assign`,{lines});return true;}
  case 'pt':UI.pt=t.dataset.t==='done'?'done':'';await load();return true;
  case 'price':{const ids=[...document.querySelectorAll('[data-psel]:checked')].map(x=>+x.dataset.psel);if(!ids.length){toast('Tick the items to update');return true;}
   const lines=ids.map(i=>({id:i,sellPct:val('pp-'+i),dUser:num(val('pu-'+i)),dMech:num(val('pmc-'+i)),dWhole:num(val('pw-'+i)),lossOk:!!val('pl-'+i)}));
   if(lines.some(l=>l.sellPct==='')){toast('Type the selling % of every picked item');return true;}
   lines.forEach(l=>l.sellPct=num(l.sellPct));act('POST','/flow/price',{lines});return true;}
  case 'ctr':UI.ctr=t.dataset.c;UI.cb='';await load();return true;
  case 'cb':UI.cb=t.dataset.b;await load();return true;
  case 'stk':{if(t.dataset.st!=='priced'){OV={t:'cmgr',name:t.dataset.n};render();return true;}
   const shelf=val('sh-'+id);if(!shelf){toast('Type the shelf number');document.getElementById('sh-'+id).focus();return true;}
   const d=await act('POST',`/flow/lines/${id}/stock`,{shelf});if(!d&&LASTERR&&LASTERR.contactManager){OV={t:'cmgr',name:t.dataset.n};render();}return true;}
 }
 return false;}
function flowChange(t,a){
 if(a==='fu-file'){fuFiles(t);return true;}
 if(t.id==='fuv'||t.id==='fudate'){keepFu();render();return true;}   // Sam 6 Nov live test: credit days + due date show as soon as the vendor / date is picked
 if(a==='fu-l'){keepFu();const l=FU.lines[+t.dataset.i];if(!l)return true;const k=t.dataset.k;l[k]=t.value;if(['pno','name','mrp'].includes(k))fuMark(+t.dataset.i);if(k==='mrp'&&l.mrpFrom!=='bill'&&l.mrpFrom!=='list')l.mrpFrom='';
  if(k==='pno'&&t.value.trim())fuLook(+t.dataset.i);else setTimeout(render,0);return true;}
 if(a==='dv'){UI.dv=t.value;load();return true;}
 if(a==='ab'){const c=ctrOfB(t.value);const s=document.getElementById('ac-'+t.dataset.id);if(c&&s)s.value=c;const ck=document.querySelector(`[data-asel="${t.dataset.id}"]`);if(ck)ck.checked=true;return true;}
 return false;}
function flowInput(t){if(t.dataset.pr){priceLive(t.dataset.pr);return true;}if(t.dataset.act==='fu-l'&&['pno','name','mrp'].includes(t.dataset.k)){const l=FU.lines[+t.dataset.i];if(l){l[t.dataset.k]=t.value;fuMark(+t.dataset.i);}return true;}return false;}
async function flowSubmit(f){
 if(f==='fdue'){act('POST',`/flow/bills/${OV.b.id}/due`,{due:val('fdnew'),why:val('fdwhy')});return true;}
 if(f==='fctr'){const c={};document.querySelectorAll('[data-fctr]').forEach(i=>{const v=i.value.split(',').map(x=>x.trim()).filter(Boolean);if(v.length)c[i.dataset.fctr]=v;});act('POST','/flow/counters',{counters:c});return true;}
 if(f==='fmail'){act('POST','/flow/price-mail',{to:val('fmto')});return true;}
 return false;}
const flowSettings=()=>OWNER?card('Bike Pharma restock',`<form class="grid" data-form="fctr" novalidate><b>Counters and their brands</b>${Object.entries(FB().counters).concat([[`C${Object.keys(FB().counters).length+1}`,[]]]).slice(0,9).map(([c,l])=>field('fc-'+c,c,l.join(', '),{ph:'Brand, Brand'})).join('').replace(/id="fc-(C\d)"/g,'id="fc-$1" data-fctr="$1"')}<button class="btn pri" style="align-self:flex-start">Save counters</button></form>
`):'';

// ---------------- overlays (forms in a box)
function overlay(){if(!OV)return '';const p=OV.part;
 const fo=flowOverlay();if(fo)return fo;
 if(OV.t==='edit')return modal(`Edit · ${esc(p.name)}`,partForm(p,false)+`<button class="btn pri" style="padding:12px">Save</button>`,'edit',true);
 if(OV.t==='reduce')return modal(`Cut stock · ${esc(p.name)}`,`<span class="muted">${p.stock} in stock. Every cut is in the stock log with your name.</span>${field('rq','How many?','',{num:1})}${field('rwhy','Why?','Damaged',{type:'select',opts:S.lists.reduceWhy})}${field('rnote','Note','',{ph:'What happened'})}<button class="btn pri" style="padding:12px">Cut from stock</button>`,'reduce');
 if(OV.t==='return')return modal(`Customer return · ${esc(p.name)}`,`${field('tq','How many came back?','1',{num:1})}${field('tbill','Bill no. of the sale *','',{ph:'BS-4021'})}${field('tnote','Note','',{ph:'Not fitting, wrong model …'})}<button class="btn pri" style="padding:12px">Put back in stock</button>`,'return');
 if(OV.t==='vreturn')return modal(`Back to vendor · ${esc(p.name)}`,`${field('vrv','Vendor','',{type:'select',opts:S.lists.vendors.filter(v=>v.active).map(v=>[v.id,v.name])})}${field('vrq','How many?','1',{num:1})}${COST?field('vrr','Rate (₹)',p.cost,{num:1}):''}${field('vrw','Why?','',{ph:'Damaged in box, wrong part …'})}<button class="btn pri" style="padding:12px">Send back</button>`,'vreturn');
 if(OV.t==='order')return modal('Add to order sheet',`${OV.name?`<b>${esc(OV.name)}</b>`:`${field('oname','Part name *')}${field('opno','Part no.')}${field('obrand','Brand')}`}${field('oqty','Quantity',OV.q||1,{num:1})}${field('ovend','Vendor','',{list:'dlv'})}<datalist id="dlv">${S.lists.vendors.map(v=>`<option value="${esc(v.name)}">`).join('')}</datalist>${field('oprom','Promised day','',{type:'date'})}${OV.again?field('oagain','',true,{type:'check',text:'Order again (it is already on the sheet)'}):''}<button class="btn pri" style="padding:12px">Add</button>`,'order');
 if(OV.t==='oedit')return modal('Change order row',`${field('eq','Quantity',OV.o.qty,{num:1})}${field('ev','Vendor',OV.o.vendor)}${field('ep','Promised day',OV.o.promise,{type:'date'})}<button class="btn pri" style="padding:12px">Save</button>`,'oedit');
 if(OV.t==='orecv')return modal('Goods received',`${field('rq2','How many came?',OV.left,{num:1})}<span class="muted">They go into stock now.</span><button class="btn pri" style="padding:12px">Received</button>`,'orecv');
 if(OV.t==='pick')return `<div class="scrim" data-act="close-ov"><div class="panel" data-stop role="dialog" aria-label="Pick a part"><div class="in">${ic('search')}<input id="pk" placeholder="Type part no. or name, or scan" value="${esc(OV.q||'')}" autocomplete="off"><button class="btn" data-act="close-ov" aria-label="Close">${ic('x')}</button></div><div class="res">${(OV.rows||[]).map(p=>`<button class="ri" data-act="picked" data-id="${p.id}"><span class="cell2" style="flex:1"><b>${esc(p.name)}</b><small><span class="mono">${esc(p.pno)}</span> · ${esc(p.model||p.brand||'')} · stock ${p.stock} · ${inr(p.mrp)}</small></span></button>`).join('')||`<div class="empty">${OV.q?'No match':'Start typing'}</div>`}</div></div></div>`;
 if(OV.t==='newline')return modal('New part on this bill',`${grid(180,[field('npno','Part no. *'),field('nname','Part name *'),field('nbrand','Brand'),field('nmodel','Model'),field('nmrp','MRP (₹) *','',{num:1}),field('nhsn','HSN'),field('ngst','GST %',18,{type:'select',opts:S.lists.gst}),field('nalert','Low-stock alert at',1,{num:1}),field('nrack','Rack')].join(''))}<button class="btn pri" style="padding:12px">Add line</button>`,'newline',true);
 if(OV.t==='vendor')return modal(OV.v?`Edit · ${esc(OV.v.name)}`:'New vendor',`${field('vname','Name *',OV.v&&OV.v.name)}${field('vphone','Phone',OV.v&&OV.v.phone,{num:1})}${field('vgst','GSTIN',OV.v&&OV.v.gstin)}${field('vaddr','Address',OV.v&&OV.v.address)}${field('vdays','Credit days',OV.v?OV.v.days:30,{num:1})}${field('vbr','Brands they supply',OV.v&&OV.v.brands,{ph:'Hero, Honda'})}${PAYS?`<div class="fsec"><b>Bank details for payment</b><small class="muted">All five, or leave all empty.</small></div>${field('vaccn','Account holder name',OV.v&&OV.v.acc_name)}${field('vaccno','Account number',OV.v&&OV.v.acc_no,{num:1})}${field('vaccno2','Account number again',OV.v&&OV.v.acc_no,{num:1})}${field('vifsc','IFSC',OV.v&&OV.v.ifsc,{ph:'SBIN0001234'})}${field('vbname','Bank name',OV.v&&OV.v.bank_name,{ph:'State Bank of India'})}${field('vbranch','Branch',OV.v&&OV.v.branch,{ph:'P B Road, Davanagere'})}${field('vbank','UPI id (optional)',OV.v&&OV.v.bank,{ph:'name@okaxis'})}`:''}${COST?field('vopen','Opening dues (₹)',OV.v?OV.v.opening:0,{num:1}):''}${OV.v?field('vact','',!!OV.v.active,{type:'check',text:'Active'}):''}<button class="btn pri" style="padding:12px">Save</button>`,'vendor');
 if(OV.t==='pay')return modal(`Pay · ${esc(OV.b.no)}`,`<span class="muted">Balance ${inr(OV.b.balance,2)}</span>${OV.b.bank&&OV.b.bank.acc_no?`<div class="cell2" style="background:var(--bg2,rgba(127,127,127,.08));padding:10px;border-radius:8px"><small class="muted">Pay to</small><b>${esc(OV.b.bank.acc_name)}</b><small class="mono">A/c ${esc(OV.b.bank.acc_no)} · IFSC ${esc(OV.b.bank.ifsc)}</small><small>${esc(OV.b.bank.bank_name)}, ${esc(OV.b.bank.branch)}${OV.b.bank.upi?' · UPI '+esc(OV.b.bank.upi):''}</small></div>`:OV.b.bank?pill('Vendor bank details missing: add them in Vendors','orange'):''}${field('pamt','Amount (₹)',OV.b.balance,{num:1})}${field('pmode','Mode','Bank',{type:'select',opts:S.lists.payModes})}${field('pref','Ref / UTR / cheque no.')}${field('pday','Day',S.clock.today,{type:'date'})}${field('pclr','',false,{type:'check',text:'Clear the bill (vendor gave a discount for the rest)'})}<button class="btn pri" style="padding:12px">Save payment</button>`,'pay');
 if(OV.t==='cancel')return modal(`Cancel · ${esc(OV.b.no)}`,`<span class="muted">Its parts come out of stock again.</span>${field('cwhy','Why? *')}<button class="btn pri" style="padding:12px">Cancel the bill</button>`,'cancel');
 if(OV.t==='transfer')return modal('New transfer',`${field('tdir','Direction','dvg-rnr',{type:'select',opts:[['dvg-rnr','Davanagere → Ranebennur (stock out)'],['rnr-dvg','Ranebennur → Davanagere (stock in)']]})}<div class="row"><button type="button" class="btn" data-act="tr-pick">${ic('search')} ${OV.p?esc(OV.p.name)+' · stock '+OV.p.stock:'Pick the part'}</button></div>${OV.p?'':`<details><summary class="muted">Not in the list? (only Ranebennur → Davanagere)</summary>${grid(160,[field('tnpno','Part no.'),field('tnname','Part name'),field('tnmrp','MRP (₹)','',{num:1})].join(''))}</details>`}${field('tqty','Quantity',1,{num:1})}${field('tmargin','Margin %',0,{num:1})}${field('tday','Day',S.clock.today,{type:'date'})}${field('tnote','Note')}<button class="btn pri" style="padding:12px">Save transfer</button>`,'transfer');
 if(OV.t==='bulk')return modal(`Change ${UI.sel.size} parts together`,`<span class="muted">Only filled boxes change.</span>${grid(160,[field('brack','Rack'),field('balert','Alert at','',{num:1}),field('bdu','Customer disc %','',{num:1}),field('bdm','Mechanic disc %','',{num:1}),field('bdw','Wholesale disc %','',{num:1}),field('bgst','GST %','',{type:'select',opts:[['','No change'],...S.lists.gst.map(g=>[g,g+' %'])]}),field('bhsn','HSN')].join(''))}<button class="btn pri" style="padding:12px">Change them</button>`,'bulk',true);
 if(OV.t==='acc')return modal('New login',`${field('aname','Name *')}${field('aphone','Phone *','',{num:1})}${field('arole','Role','store',{type:'select',opts:[['store','Store keeper'],['manager','Inventory manager'],['accountant','Accountant'],['cashier','Cashier (uploads vendor bills)'],['supervisor','Supervisor (New stock)'],['counter','Counter staff'],['owner','Owner']]})}${field('actr','Counter (only for counter staff)','',{type:'select',opts:[['','—'],...Object.keys(FB().counters).map(c=>[c,ctrLabel(c)])]})}${field('apin','4-digit PIN *','',{num:1})}<button class="btn pri" style="padding:12px">Add login</button>`,'acc');
 if(OV.t==='accpin')return modal('New PIN',`${field('npin','4-digit PIN','',{num:1})}<span class="muted">The person is signed out everywhere and uses the new PIN.</span><button class="btn pri" style="padding:12px">Save PIN</button>`,'accpin');
 if(OV.t==='stickers')return `<div class="scrim" data-act="close-ov"><div class="modal wide" data-stop><div class="between"><h2 style="font-size:18px">Stickers · ${OV.parts.length}</h2><span class="row"><button class="btn pri" data-act="print">${ic('printer')} Print</button><button class="btn" data-act="close-ov" aria-label="Close">${ic('x')}</button></span></div><div id="stk" class="stk">${OV.parts.map(sticker).join('')}</div></div></div>`;
 return '';}

// Code 128 (set B) barcode as SVG, for sticker printers that print what the browser prints
const C128=[212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112];
function code128(text){const s=String(text).replace(/[^\x20-\x7E]/g,'');const codes=[104,...[...s].map(c=>c.charCodeAt(0)-32)];let sum=104;codes.slice(1).forEach((c,i)=>sum+=c*(i+1));codes.push(sum%103,106);
 let x=10,bars='';for(const c of codes){const w=String(C128[c]);for(let i=0;i<w.length;i++){const n=+w[i];if(i%2===0)bars+=`<rect x="${x}" y="0" width="${n}" height="50"/>`;x+=n;}}
 return `<svg viewBox="0 0 ${x+10} 50" preserveAspectRatio="none" style="width:100%;height:46px" aria-label="Barcode ${esc(s)}">${bars}</svg>`;}
const sticker=p=>`<div class="stkone"><b>${esc(p.name.slice(0,38))}</b><small>${esc([p.brand,p.model].filter(Boolean).join(' · ').slice(0,40))}</small>${code128(p.bar||p.pno)}<div class="between"><span class="mono">${esc(p.bar||p.pno)}</span><b>MRP ${inr(p.mrp)}</b></div><small>Rack ${esc(p.rack||'—')} · Bike Surgeon</small></div>`;

// ---------------- events
root.addEventListener('click',async e=>{
 if(UI.route==='stockin'&&document.getElementById('sv'))keepSi();
 if(UI.route==='upload')keepFu();   // a re-draw (part picker, new vendor) must not lose the typed vendor and bill no.
 const st=e.target.closest('[data-stop]');const t=e.target.closest('[data-act],[data-go],[data-go-count]');
 if(!t){return;}
 if(st&&!st.contains(t))return;
 if(t.dataset.goCount){go('count',t.dataset.goCount);return;}
 if(t.dataset.go){e.preventDefault();go(t.dataset.go);return;}
 const a=t.dataset.act,id=t.dataset.id;
 if(t.tagName==='INPUT'&&['sel','sel-all','photo','csvfile'].indexOf(a)<0&&t.type!=='checkbox')return;
 switch(a){
  case 'close-ov':if(e.target===t||t.tagName==='BUTTON'){OV=null;render();}break;
  case 'menu':UI.menu=!UI.menu;render();break;
  case 'logout':await fetch('/api/logout',{method:'POST'}).catch(()=>{});location.reload();break;
  case 'nt':UI.nt=!UI.nt;if(UI.nt){ALERTS=null;render();const d=await api('GET','/alerts');ALERTS=d?d.alerts:[];if(S.unseen){api('POST','/alerts/seen',{});S.unseen=0;}}render();break;
  case 'alert':{const k=t.dataset.k,r=t.dataset.ref;UI.nt=false;if(['newstock','price','tat','disc'].includes(k)){go(k==='price'?'pricing':k==='disc'?'dues':k==='tat'?(SUP?'newstock':BOSS?'tracker':HOME):'newstock');break;}if(['low','out','neg'].includes(k)){UI.q=r;UI.f='';go('parts');}else if(k==='count')go('count',r);else if(['due','late','bill'].includes(k)){UI.bq=r;go('bills');}else if(k==='link')go('settings');else render();break;}
  case 'store':UI.store=t.dataset.s;UI.brand='';UI.page=1;UI.sel=new Set();await load();break;
  case 'part':e.preventDefault();go('part',id);break;
  case 'vendor':go('vendor',id);break;
  case 'bill':go('bill',id);break;
  case 'pf':UI.f=t.dataset.f;UI.page=1;if(UI.route!=='parts')UI.route='parts';await load();break;
  case 'pg':UI.page=+t.dataset.p;await load();window.scrollTo(0,0);break;
  case 'sel':{const n=+id;t.checked?UI.sel.add(n):UI.sel.delete(n);render();break;}
  case 'sel-all':DATA.rows.forEach(p=>t.checked?UI.sel.add(p.id):UI.sel.delete(p.id));render();break;
  case 'sel-none':UI.sel=new Set();render();break;
  case 'stickers':{const d=await api('GET',`/parts?ids=${[...UI.sel].join(',')}&size=200`);if(d){OV={t:'stickers',parts:d.rows};render();}break;}
  case 'stickers-one':OV={t:'stickers',parts:[DATA.part]};render();break;
  case 'print':document.body.classList.add('printing');window.print();setTimeout(()=>document.body.classList.remove('printing'),500);break;
  case 'bulk':OV={t:'bulk'};render();break;
  case 'edit-part':OV={t:'edit',part:DATA.part};render();break;
  case 'reduce':OV={t:'reduce',part:DATA.part};render();break;
  case 'return-in':OV={t:'return',part:DATA.part};render();break;
  case 'vreturn':OV={t:'vreturn',part:DATA.part};render();break;
  case 'part-off':if(confirmBox('Remove this part from the list? Old bills keep it.'))act('POST',`/parts/${DATA.part.id}/active`,{active:false});break;
  case 'part-on':act('POST',`/parts/${DATA.part.id}/active`,{active:true});break;
  case 'join':if(confirmBox('Join the other rows into this one? Their stock, photos and sales move here.'))act('POST',`/parts/${DATA.part.id}/join`,{ids:t.dataset.ids.split(',').map(Number)});break;
  case 'photo-del':if(confirmBox('Remove this photo?'))act('DELETE',`/parts/${DATA.part.id}/photos/${t.dataset.pid}`);break;
  case 'order-add':{let name='';if(DATA&&DATA.part&&+id===DATA.part.id)name=DATA.part.name;else{const r=(DATA&&DATA.rows||[]).find(x=>x.id===+id);name=r?r.name:'part';}OV={t:'order',part:+id,name,q:t.dataset.q||1};render();break;}
  case 'order-free':OV={t:'order'};render();break;
  case 'o-recv':OV={t:'orecv',id,left:t.dataset.left};render();break;
  case 'o-edit':OV={t:'oedit',o:DATA.rows.find(o=>o.id===+id)};render();break;
  case 'o-cancel':if(confirmBox('Cancel this order row?'))act('PATCH',`/orders/${id}`,{cancel:true});break;
  case 'count-new':CNT.rack='';CNT.lines=[];UI.route='countnew';await load();break;
  case 'count-save':{const lines=[...document.querySelectorAll('[data-cnt]')].filter(i=>i.value.trim()!=='').map(i=>({part:+i.dataset.cnt,counted:num(i.value)}));if(!lines.length){toast('Type at least one count');break;}const d=await act('POST','/counts',{rack:CNT.rack,lines},async d=>{go('count',d.no);});break;}
  case 'count-apply':act('POST',`/counts/${encodeURIComponent(UI.param)}/apply`,{});break;
  case 'count-drop':if(confirmBox('Drop this rack check? Stock stays as it is.'))act('POST',`/counts/${encodeURIComponent(UI.param)}/apply`,{drop:true});break;
  case 'gst-done':act('POST','/data-check/gst-done',{store:UI.store,pno:t.dataset.pno});break;
  case 'vendor-new':OV={t:'vendor'};render();break;
  case 'vendor-edit':OV={t:'vendor',v:DATA.vendor};render();break;
  case 'vr-done':act('POST',`/vendor-returns/${encodeURIComponent(t.dataset.no)}/done`,{status:t.dataset.s});break;
  case 'pay':OV={t:'pay',b:DATA.bill};render();break;
  case 'bill-cancel':OV={t:'cancel',b:DATA.bill};render();break;
  case 'bf':{const f=t.dataset.f;UI.blate=f==='late';UI.bst=f==='late'?'':f;await load();break;}
  case 'tr-new':OV={t:'transfer'};render();break;
  case 'tr-pick':{const keep={...OV};OV={t:'pick',q:'',rows:[],then:p=>{OV={...keep,p};render();}};render();break;}
  case 'si-add':OV={t:'pick',q:'',rows:[],store:val('sstore')||SI.store,then:p=>{keepSi();if(SI.lines.some(l=>l.part===p.id)){toast('Already on this bill');OV=null;render();return;}SI.lines.push({part:p.id,p,qty:1,rate:COST&&p.cost?p.cost:'',gst:p.gst,mrp:p.mrp});OV=null;render();}};render();break;
  case 'si-new':keepSi();OV={t:'newline'};render();break;
  case 'si-del':keepSi();SI.lines.splice(+t.dataset.i,1);render();break;
  case 'si-save':saveStockIn();break;
  case 'picked':{const p=(OV.rows||[]).find(x=>x.id===+id);if(p&&OV.then)OV.then(p);break;}
  case 'tab':UI.tab=t.dataset.t;await load();break;
  case 'days':UI.days=+t.dataset.n;await load();break;
  case 'retry':act('POST',`/links/retry/${id}`,{});break;
  case 'acc-new':OV={t:'acc'};render();break;
  case 'acc-pin':OV={t:'accpin',id};render();break;
  case 'acc-onoff':act('PATCH',`/accounts/${id}`,{active:t.dataset.on==='1'});break;
  case 'push-on':pushOn();break;
  case 'csv-check':csvRun(true);break;
  case 'csv-load':csvRun(false);break;
  default:await flowClick(a,t,id);
 }});
const confirmBox=m=>window.confirm(m);
root.addEventListener('change',async e=>{const t=e.target;const a=t.dataset.act;
 if(flowChange(t,a))return;
 if(a==='photo'){for(const f of t.files){if(f.size>20*1024*1024){toast(`${f.name} is bigger than 20 MB`);continue;}const data=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f);});const d=await api('POST',`/parts/${DATA.part.id}/photos`,{data});if(d)toast(d.msg);}await refreshState();await load();}
 if(a==='csvfile'){const f=t.files[0];if(!f)return;UI.csv=await f.text();UI.csvName=f.name;UI.csvOk=false;UI.csvOut=null;OV=null;render();document.getElementById('csvname').textContent=f.name;}
 if(a==='si-l'){SI.lines[+t.dataset.i][t.dataset.k]=t.value;keepSi();setTimeout(render,0);}   // after Tab has moved on, so the next box keeps the cursor
 if(a==='oday'){UI.param=t.value;await load();}
 if(a==='acc-role')act('PATCH',`/accounts/${t.dataset.id}`,{role:t.value});
});
root.addEventListener('input',async e=>{const t=e.target;
 if(flowInput(t))return;
 if(t.id==='pk'){OV.q=t.value;const q=t.value.trim();if(q.length<2){OV.rows=[];render();return;}clearTimeout(OV.tm);OV.tm=setTimeout(async()=>{const d=await api('GET',`/parts?${qs({q,store:OV.store||UI.store,size:30})}`);if(d&&OV&&OV.t==='pick'&&OV.q===t.value){OV.rows=d.rows;render();}},220);}});
function keepSi(){SI.vendor=val('sv')||SI.vendor;SI.invNo=val('sinv')||SI.invNo;SI.invDate=val('sdate')||SI.invDate;SI.store=val('sstore')||SI.store;SI.amount=val('samt');SI.notes=val('snotes');}
async function saveStockIn(){keepSi();if(!SI.vendor){toast('Pick the vendor');return;}if(!SI.invNo){toast("Type the vendor's bill number");return;}
 const body={vendor:+SI.vendor,invNo:SI.invNo,invDate:SI.invDate||S.clock.today,store:SI.store,amount:num(SI.amount)||undefined,notes:SI.notes,dupOk:!!val('sdup'),
  lines:SI.lines.map(l=>({...(l.part?{part:l.part}:{new:l.new}),qty:num(l.qty),rate:num(l.rate),gst:num(l.gst),mrp:num(l.mrp)||undefined}))};
 const d=await api('POST','/stock-in',body);
 if(!d){if(document.querySelector('.toast')&&/already entered/.test(document.querySelector('.toast').textContent)){SI.dup=true;render();}return;}
 toast(d.msg);Object.assign(SI,{vendor:'',invNo:'',invDate:'',lines:[],amount:'',notes:'',dup:false});await refreshState();go('bill',d.id);}
async function csvRun(dry){if(!UI.csv)return;const d=await api('POST','/import/parts-csv',{csv:UI.csv,store:UI.store,dryRun:dry});if(!d)return;UI.csvOut=d;UI.csvOk=dry&&!d.errors.length||dry;toast(d.msg);if(!dry){UI.csv=null;UI.csvOk=false;await refreshState();}render();}
async function pushOn(){if(!S.push){toast('Push is off on this server');return;}
 try{await new Promise((res,rej)=>{if(window.OneSignal)return res();const s=document.createElement('script');s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  OneSignalDeferred.push(async OS=>{await OS.init({appId:S.push.appId});await OS.Notifications.requestPermission();const id=OS.User.PushSubscription.id;if(id){const d=await api('POST','/push/device',{player:id});if(d)toast(d.msg);}else toast('Allow notifications in the browser, then press again.');});
 }catch(e){toast('Could not switch on push here.');}}

root.addEventListener('submit',async e=>{e.preventDefault();const f=e.target.dataset.form;
 if(await flowSubmit(f))return;
 if(f==='scan'){const q=val('scanq');if(!q)return;const d=await api('GET',`/parts/code/${encodeURIComponent(q)}?store=${UI.store}`);if(d&&d.rows.length===1){go('part',d.rows[0].id);return;}UI.q=q;UI.f='';UI.page=1;go('parts');return;}
 if(f==='pfilter'){UI.q=val('pq');UI.brand=val('pb');UI.sort=val('ps');UI.page=1;await load();return;}
 if(f==='mfilter'){UI.q2=val('mq');UI.why=val('mw');UI.from=val('mf');UI.to=val('mt');await load();return;}
 if(f==='bfilter'){UI.bq=val('bq');await load();return;}
 if(f==='cnt-rack'){CNT.rack=val('crack').toUpperCase();await load();return;}
 if(f==='add'){const b=partBody(true);if(!b.pno||!b.name){toast('Part number and name are needed');return;}const d=await api('POST','/parts',b);if(!d){render();return;}toast(d.msg);OV=null;await refreshState();go('part',d.id);return;}
 if(f==='edit'){const b=partBody(false);b.v=OV.part.v;act('PATCH',`/parts/${OV.part.id}`,b);return;}
 if(f==='reduce'){act('POST',`/parts/${OV.part.id}/reduce`,{qty:num(val('rq')),why:val('rwhy'),note:val('rnote')});return;}
 if(f==='return'){act('POST',`/parts/${OV.part.id}/return`,{qty:num(val('tq')),bill:val('tbill'),note:val('tnote')});return;}
 if(f==='vreturn'){act('POST','/vendor-returns',{vendor:+val('vrv'),part:OV.part.id,qty:num(val('vrq')),...(COST?{rate:num(val('vrr'))}:{}),why:val('vrw')});return;}
 if(f==='order'){const b=OV.part?{part:OV.part}:{name:val('oname'),pno:val('opno'),brand:val('obrand'),store:UI.store};Object.assign(b,{qty:num(val('oqty')),vendor:val('ovend'),promise:val('oprom'),again:!!val('oagain')});
  const d=await api('POST','/orders',b);if(!d){if(OV.part){OV.again=true;render();}return;}toast(d.msg);OV=null;await refreshState();await load();return;}
 if(f==='oedit'){act('PATCH',`/orders/${OV.o.id}`,{qty:num(val('eq')),vendor:val('ev'),promise:val('ep')});return;}
 if(f==='orecv'){act('PATCH',`/orders/${OV.id}`,{receive:num(val('rq2'))});return;}
 if(f==='newline'){const n={pno:val('npno'),name:val('nname'),brand:val('nbrand'),model:val('nmodel'),mrp:num(val('nmrp')),hsn:val('nhsn'),gst:num(val('ngst')),alert:num(val('nalert')),rack:val('nrack')};if(!n.pno||!n.name||!n.mrp){toast('Part no., name and MRP are needed');return;}SI.lines.push({new:n,qty:1,rate:'',gst:n.gst,mrp:n.mrp});OV=null;render();return;}
 if(f==='vendor'){const b={name:val('vname'),phone:val('vphone'),gstin:val('vgst'),address:val('vaddr'),days:num(val('vdays')),brands:val('vbr'),bank:val('vbank')};if(document.getElementById('vaccno'))Object.assign(b,{accName:val('vaccn'),accNo:val('vaccno'),accNo2:val('vaccno2'),ifsc:val('vifsc'),bankName:val('vbname'),branch:val('vbranch')});if(COST&&document.getElementById('vopen'))b.opening=num(val('vopen'));if(OV.v)b.active=!!val('vact');
  const d=await act(OV.v?'PATCH':'POST',OV.v?`/vendors/${OV.v.id}`:'/vendors',b,async d=>{if(UI.route==='stockin'){SI.vendor=d.id;render();}else await load();});return;}
 if(f==='pay'){act('POST',`/bills/${OV.b.id}/pay`,{amount:num(val('pamt')),mode:val('pmode'),ref:val('pref'),day:val('pday'),clear:!!val('pclr')});return;}
 if(f==='cancel'){act('POST',`/bills/${OV.b.id}/cancel`,{why:val('cwhy')});return;}
 if(f==='transfer'){const b={dir:val('tdir'),qty:num(val('tqty')),margin:num(val('tmargin')),day:val('tday'),note:val('tnote')};if(OV.p)b.part=OV.p.id;else if(val('tnname'))b.new={pno:val('tnpno'),name:val('tnname'),mrp:num(val('tnmrp'))};act('POST','/transfers',b);return;}
 if(f==='bulk'){const set={};[['rack','brack'],['alert','balert'],['dUser','bdu'],['dMech','bdm'],['dWhole','bdw'],['gst','bgst'],['hsn','bhsn']].forEach(([k,i])=>{const v=val(i);if(v!=='')set[k]=['rack','hsn'].includes(k)?v:num(v);});act('POST','/parts/bulk',{ids:[...UI.sel],set},async()=>{UI.sel=new Set();await load();});return;}
 if(f==='pin'){act('POST','/pin',{old:val('pold'),pin:val('pnew')});return;}
 if(f==='settings'){act('POST','/settings',{gst:val('sgst'),reduceAlert:num(val('sred')),alertPhones:val('sphones')});return;}
 if(f==='acc'){act('POST','/accounts',{name:val('aname'),phone:val('aphone'),role:val('arole'),pin:val('apin'),ctr:val('actr')||undefined});return;}
 if(f==='accpin'){act('PATCH',`/accounts/${OV.id}`,{pin:val('npin')});return;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&OV){OV=null;render();}});

// start on the page in the address (#parts, #part/12 …)
const fromHash=()=>{const h=location.hash.slice(1).split('/').map(x=>{try{return decodeURIComponent(x)}catch(e){return x}});return h[0]&&ROUTES[h[0]]?h:null;};
// a typed address or a pasted link (#part/12) opens that page
window.addEventListener('hashchange',()=>{const h=fromHash();if(h&&(h[0]!==UI.route||(h[1]||null)!==(UI.param==null?null:String(UI.param))))go(h[0],h[1]||null);});
(function(){const h=fromHash();if(h){UI.route=h[0];UI.param=h[1]||null;}load();})();
};
