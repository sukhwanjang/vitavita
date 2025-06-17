import { RequestItem } from '../types';

export const handlePrintTodayWork = (requests: RequestItem[]) => {
  const now = new Date();
  // UTC 기준 한국시간(+9시간)으로 변환
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = koreaTime.toISOString().slice(0, 10); // 한국 날짜로 today 결정

  const todayRequests = requests.filter(r => {
    const createdAtKorea = new Date(new Date(r.created_at).getTime() + 9 * 60 * 60 * 1000);
    return createdAtKorea.toISOString().slice(0, 10) === today && !r.is_deleted;
  }).reverse();

  // 작업자별로 그룹화
  const grouped = todayRequests.reduce((acc, item) => {
    const key = item.creator || '미지정';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, RequestItem[]>);

  let html = `
    <html>
    <head>
      <title>오늘 작업 출력</title>
      <style>
        body {
          font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
          background: #f8fafc;
          color: #222;
          margin: 0;
          padding: 32px 0;
        }
        h1 {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 32px;
          text-align: center;
          letter-spacing: -1px;
        }
        .creator-block {
          margin-bottom: 40px;
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 2px 12px 0 #0001;
          padding: 24px 32px;
        }
        .creator-title {
          font-size: 18px;
          font-weight: 600;
          color: #2563eb;
          margin-bottom: 18px;
          letter-spacing: -0.5px;
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          background: #f9fafb;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px 0 #0001;
        }
        th, td {
          padding: 10px 12px;
          font-size: 14px;
          text-align: left;
        }
        th {
          background: #e0e7ef;
          color: #222;
          font-weight: 700;
          border-bottom: 2px solid #cbd5e1;
        }
        tr:nth-child(even) td {
          background: #f3f6fa;
        }
        tr:nth-child(odd) td {
          background: #fff;
        }
        td {
          border-bottom: 1px solid #e5e7eb;
        }
        @media print {
          body { background: #fff; padding: 0; }
          .creator-block { box-shadow: none; padding: 12px 0; }
          table { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <h1>오늘 작업한 내용 (한국시간)</h1>
  `;

  Object.entries(grouped).forEach(([creator, items]) => {
    html += `<div class="creator-block">`;
    html += `<div class="creator-title">${creator}</div>`;
    html += `
      <table>
        <thead>
          <tr>
            <th>업체명</th>
            <th>프로그램명</th>
            <th>업로드 시간</th>
            <th>완료 여부</th>
          </tr>
        </thead>
        <tbody>
    `;
    items.forEach((item) => {
      html += `
        <tr>
          <td>${item.company}</td>
          <td>${item.program}</td>
          <td>${new Date(item.created_at).toLocaleString('ko-KR')}</td>
          <td>${item.completed ? '완료됨' : '아직 완료 안 됨'}</td>
        </tr>
      `;
    });
    html += `</tbody></table></div>`;
  });

  html += `</body></html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
};

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