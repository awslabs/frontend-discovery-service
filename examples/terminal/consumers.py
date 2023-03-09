import os
import sys
import time
import requests
import logging
from dotenv import load_dotenv
from prettytable import PrettyTable

from datetime import datetime

results = {}
count = 10
endpoint = None
project = None
table = PrettyTable()

# Color
B = "\033[0;34;40m"  # Blue
G = "\033[0;32;40m"  # Green
N = "\033[0m"  # Reset


def main():
    logging.info(f'Got consumer api: {endpoint}')
    logging.info(f'Got project id: {project}')
    logging.info(f'Simulating requests for {count} users')
    logging.info(f'GET: {endpoint}/projects/{project}/microFrontends')

    table.field_names = ["User", "USER_TOKEN",
                         "Requests", "Last Version", "Last URL", "Last Request"]
    tablePrinted = False
    init_results()
    while True:
        for i in range(count):
            send_request(i)

        display_results(tablePrinted)
        tablePrinted = True
        check_end()
        time.sleep(5)


def init_results():
    for i in range(count):
        results[i] = {
            'count': 0,
            'url': '',
            'version': '',
            'USER_TOKEN': None
        }


def send_request(i):
    cookies = {} if results[i]['USER_TOKEN'] is None else {
        'USER_TOKEN':  results[i]['USER_TOKEN']}

    r = requests.get(
        f'{endpoint}/projects/{project}/microFrontends', cookies=cookies)
    data = r.json()
    headers = r.headers

    mfe = data['microFrontends']['my-project/catalog'][0]
    results[i]['url'] = mfe['url']
    results[i]['version'] = mfe['metadata']['version']

    results[i]['count'] += 1
    if 'Set-Cookie' in headers:
        cookie = headers['Set-Cookie'].split(';')[0]
        results[i]['USER_TOKEN'] = cookie.split('=')[1]


def display_results(tablePrinted):
    table.clear_rows()
    now = datetime.now().strftime('%d-%m-%Y %H:%M:%S')

    for idx, result in results.items():

        if result['version'] == '1.0.0':
            version = B + result['version'] + N
        else:
            version = G + result['version'] + N

        table.add_row([idx, result['USER_TOKEN'], result['count'],
                      version, result['url'], now])

    if tablePrinted:
        clearRows()

    print(table)


def check_end():
    unfinished = False
    for idx, result in results.items():
        if result['version'] == '1.0.0':
            unfinished = True

    if not unfinished:
        logging.info("All users now receiving new version.")
        exit(0)


def clearRows():
    prev_lines = count + 4
    for i in range(prev_lines):
        sys.stdout.write('\033[F')


if __name__ == "__main__":
    load_dotenv()
    endpoint = os.getenv('CONSUMER_API')
    project = os.getenv('PROJECT_ID')
    logging.getLogger().setLevel(logging.INFO)
    logging.basicConfig(format="%(asctime)s %(message)s",
                        datefmt="%d/%m/%Y %I:%M:%S %p")
    main()
