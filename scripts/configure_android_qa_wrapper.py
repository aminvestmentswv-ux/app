"""Bound the disposable QA wrapper download wait; preserve the verified source URL."""
from pathlib import Path
import re


def configure(path):
    path = Path(path)
    text = path.read_text()
    urls = re.findall(r'^distributionUrl=(.+)$', text, re.M)
    if len(urls) != 1 or not re.fullmatch(r'https\\?://services\.gradle\.org/distributions/gradle-[0-9.]+-bin\.zip', urls[0]):
        raise ValueError('Unexpected Gradle distribution URL')
    timeouts = re.findall(r'^networkTimeout=(\d+)$', text, re.M)
    if timeouts not in (['10000'], ['60000']):
        raise ValueError('Unexpected Gradle download timeout')
    path.write_text(re.sub(r'^networkTimeout=\d+$', 'networkTimeout=60000', text, flags=re.M))


if __name__ == '__main__':
    configure('android/gradle/wrapper/gradle-wrapper.properties')
