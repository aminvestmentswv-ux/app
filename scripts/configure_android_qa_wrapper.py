"""Configure the exact official Gradle artifact for the disposable QA build."""
from pathlib import Path
import re

SOURCE = r'https\://services.gradle.org/distributions/gradle-9.4.1-bin.zip'
ASSET = r'https\://github.com/gradle/gradle-distributions/releases/download/v9.4.1/gradle-9.4.1-bin.zip?download=1'
# Verified against both Gradle's .sha256 endpoint and its official GitHub asset digest.
SHA256 = '2ab2958f2a1e51120c326cad6f385153bb11ee93b3c216c5fccebfdfbb7ec6cb'


def configure(path):
    path = Path(path)
    text = path.read_text()
    urls = re.findall(r'^distributionUrl=(.+)$', text, re.M)
    if len(urls) != 1 or urls[0] not in (SOURCE, ASSET):
        raise ValueError('Unexpected Gradle distribution URL')
    timeouts = re.findall(r'^networkTimeout=(\d+)$', text, re.M)
    if timeouts not in (['10000'], ['60000']):
        raise ValueError('Unexpected Gradle download timeout')
    checksums = re.findall(r'^distributionSha256Sum=(.+)$', text, re.M)
    if checksums not in ([], [SHA256]):
        raise ValueError('Unexpected Gradle distribution checksum')
    text = re.sub(r'^distributionUrl=.+$', lambda _: 'distributionUrl=' + ASSET, text, flags=re.M)
    text = re.sub(r'^networkTimeout=\d+$', 'networkTimeout=60000', text, flags=re.M)
    if not checksums:
        text = text.rstrip('\n') + '\ndistributionSha256Sum=' + SHA256 + '\n'
    path.write_text(text)


if __name__ == '__main__':
    configure('android/gradle/wrapper/gradle-wrapper.properties')
