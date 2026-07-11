
export const handlePrintImage = (imageUrl: string, company: string, program: string) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    const html = `
      <html>
        <head>
          <title>${company} - ${program} 출력</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-family: sans-serif;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .image-container {
              max-width: 100%;
              height: auto;
            }
            img {
              max-width: 100%;
              height: auto;
              object-fit: contain;
            }
            @media print {
              body {
                padding: 0;
              }
              .header {
                margin-bottom: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${company}</h2>
            <p>${program}</p>
          </div>
          <div class="image-container">
            <img src="${imageUrl}" alt="${company} - ${program}" />
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}; 