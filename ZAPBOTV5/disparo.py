import time
import random
import urllib.parse
import pandas as pd
 
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
 
 
# ══════════════════════════════
#  CONFIGURAÇÕES — edite aqui
# ══════════════════════════════
 
ARQUIVO_CONTATOS = "contatos.xlsx"
ARQUIVO_FRASES   = "frases.txt"
 
# Intervalo entre cada disparo (segundos)
DELAY_MIN = 53
DELAY_MAX = 61
 
# Caminho do perfil do Chrome (manter sessão logada no WhatsApp)
# Altere para o seu usuário do Windows:
CHROME_PROFILE = r"C:\Users\SEU_USUARIO\AppData\Local\Google\Chrome\User Data\Selenium"
 
 
# ══════════════════════════════
#  CARREGAMENTO DE DADOS
# ══════════════════════════════
 
def carregar_contatos(arquivo: str) -> pd.DataFrame:
    df = pd.read_excel(arquivo)
    df.columns = df.columns.str.strip().str.lower()
    print(f"📊 {len(df)} contatos carregados de '{arquivo}'")
    return df
 
 
def carregar_frases(arquivo: str) -> list[str]:
    with open(arquivo, "r", encoding="utf-8") as f:
        frases = [linha.strip() for linha in f if linha.strip()]
    print(f"💬 {len(frases)} frases carregadas de '{arquivo}'")
    return frases
 
 
# ══════════════════════════════
#  CONFIGURAÇÃO DO CHROME
# ══════════════════════════════
 
def criar_driver(profile_path: str) -> webdriver.Chrome:
    options = Options()
    options.add_argument(f"--user-data-dir={profile_path}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--start-maximized")
 
    service = Service(ChromeDriverManager().install())
    driver  = webdriver.Chrome(service=service, options=options)
    return driver
 
 
# ══════════════════════════════
#  AUTENTICAÇÃO WHATSAPP
# ══════════════════════════════
 
def aguardar_login(driver: webdriver.Chrome) -> None:
    driver.get("https://web.whatsapp.com")
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "pane-side"))
        )
        print("✅ WhatsApp já logado")
    except Exception:
        input("📱 Escaneie o QR Code e pressione ENTER para continuar...")
 
 
def ativar_campo_pesquisa(driver: webdriver.Chrome) -> None:
    """Ativa o campo de pesquisa para garantir que o WhatsApp está responsivo."""
    try:
        campo = WebDriverWait(driver, 60).until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[@contenteditable='true'][@role='textbox']")
            )
        )
        campo.click()
        campo.send_keys(" ")
        campo.send_keys(Keys.BACKSPACE)
        time.sleep(2)
    except Exception:
        pass
 
 
# ══════════════════════════════
#  ENVIO DE MENSAGENS
# ══════════════════════════════
 
def tratar_popup_continuar(driver: webdriver.Chrome) -> None:
    """Fecha popup 'continuar no WhatsApp Web' se aparecer."""
    try:
        botao = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//a[contains(@href,'web.whatsapp.com')]")
            )
        )
        botao.click()
        time.sleep(8)
    except Exception:
        pass
 
 
def tratar_popup_usar_web(driver: webdriver.Chrome) -> None:
    """Seleciona 'Usar WhatsApp Web' se o popup aparecer."""
    try:
        botao = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(., 'usar') or contains(., 'Use WhatsApp Web')]")
            )
        )
        botao.click()
        time.sleep(5)
    except Exception:
        pass
 
 
def numero_invalido(driver: webdriver.Chrome) -> bool:
    """Retorna True se o WhatsApp exibir erro de número inválido."""
    try:
        driver.find_element(
            By.XPATH,
            "//*[contains(text(),'número de telefone compartilhado por url é inválido')]"
        )
        return True
    except NoSuchElementException:
        return False
 
 
def enviar_mensagem(driver: webdriver.Chrome, telefone: str, nome: str, frases: list[str]) -> str:
    """
    Tenta enviar uma mensagem para o contato.
 
    Retorna:
        'ENVIADO'        — mensagem enviada com sucesso
        'NUMERO INVALIDO' — número não existe no WhatsApp
        'ERRO AO ENVIAR' — falha inesperada
    """
    frase    = random.choice(frases).replace("{nome}", nome)
    mensagem = urllib.parse.quote(frase)
    url      = f"https://web.whatsapp.com/send?phone=55{telefone}&text={mensagem}"
 
    driver.get(url)
    time.sleep(8)
 
    tratar_popup_continuar(driver)
    tratar_popup_usar_web(driver)
 
    if numero_invalido(driver):
        print(f"❌ Número inválido: {telefone}")
        return "NUMERO INVALIDO"
 
    try:
        caixa = WebDriverWait(driver, 25).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//footer//div[@contenteditable='true']")
            )
        )
        caixa.click()
        time.sleep(0.5)
        caixa.send_keys(Keys.ENTER)
 
        print(f"📨 Enviado → {nome or telefone} | {frase[:50]}...")
        return "ENVIADO"
 
    except Exception as e:
        print(f"⚠️  Erro ao enviar para {nome or telefone}: {e}")
        return "ERRO AO ENVIAR"
 
 
# ══════════════════════════════
#  LOOP PRINCIPAL
# ══════════════════════════════
 
def main() -> None:
    df     = carregar_contatos(ARQUIVO_CONTATOS)
    frases = carregar_frases(ARQUIVO_FRASES)
 
    driver = criar_driver(CHROME_PROFILE)
    aguardar_login(driver)
    ativar_campo_pesquisa(driver)
 
    enviados  = 0
    invalidos = 0
    erros     = 0
 
    for index, row in df.iterrows():
        nome     = str(row.get("nome", "")).strip()
        telefone = str(row["telefone"]).strip()
 
        status = enviar_mensagem(driver, telefone, nome, frases)
        df.at[index, "status"] = status
 
        if status == "ENVIADO":
            enviados += 1
        elif status == "NUMERO INVALIDO":
            invalidos += 1
        else:
            erros += 1
 
        delay = random.randint(DELAY_MIN, DELAY_MAX)
        print(f"   ⏱  Aguardando {delay}s...")
        time.sleep(delay)
 
    # Salva resultados
    df.to_excel(ARQUIVO_CONTATOS, index=False)
    print("\n💾 Status atualizado no arquivo")
    print(f"✅ Finalizado — Enviados: {enviados} | Inválidos: {invalidos} | Erros: {erros}")
    input("\n🔒 Pressione ENTER para fechar o navegador...")
    driver.quit()
 
 
if __name__ == "__main__":
    main()