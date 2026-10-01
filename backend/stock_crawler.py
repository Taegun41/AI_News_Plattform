import os
import datetime
import FinanceDataReader as fdr

def fetch_all_stock_data():
    """
    FinanceDataReader를 활용해 한국 거래소(KRX) 전체 종목의 오늘자 시세를 가져옵니다.
    코스피, 코스닥, 코넥스 시장의 모든 상장 종목이 포함됩니다.
    """
    try:
        # 'KRX'를 인자로 전달하면 현재 시장에 상장된 전체 종목의 
        # 종목코드, 종목명, 시가, 고가, 저가, 종가, 거래량, 등락률 등을 데이터프레임(표) 형태로 반환합니다.
        df = fdr.StockListing('KRX')
        return df
    except Exception as e:
        print(f"주식 데이터 수집 중 오류 발생: {e}")
        return None

def save_dataframe_to_csv(df, file_path):
    """
    Pandas 데이터프레임을 CSV 파일로 저장합니다.
    """
    if df is None or df.empty:
        print("저장할 주식 데이터가 없습니다.")
        return
        
    # index=False: 불필요한 행 번호(0, 1, 2...)를 제외하고 저장합니다.
    # utf-8-sig: 윈도우 엑셀 환경에서 한글이 깨지는 것을 방지합니다.
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    print(f"총 {len(df)}개 종목의 데이터가 성공적으로 저장되었습니다: {file_path}")


if __name__ == "__main__":
    print("KRX 전체 종목 데이터 단독 테스트를 시작합니다...")
    
    stock_df = fetch_all_stock_data()
    
    if stock_df is not None:
        now = datetime.datetime.now()
        year_month = now.strftime('%Y-%m')
        today_str = now.strftime('%Y%m%d')
        
        # 변경된 경로: archive_data/stock/년-월
        archive_dir = os.path.join("archive_data", "stock", year_month)
        os.makedirs(archive_dir, exist_ok=True)
        
        file_name = os.path.join(archive_dir, f'krx_all_stocks_{today_str}.csv')
        save_dataframe_to_csv(stock_df, file_name)