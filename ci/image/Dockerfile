FROM node:24-alpine

RUN apk update \
  && apk add bash curl wget tar git jq make perl-utils python3 \
  && apk add yq --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community

ENV CLOUDSDK_CORE_DISABLE_PROMPTS 1
RUN curl -sSL https://sdk.cloud.google.com | bash
ENV PATH $PATH:/root/google-cloud-sdk/bin

ENV GH_CLI_VERSION 2.23.0
RUN mkdir ghcli && cd ghcli \
  && wget https://github.com/cli/cli/releases/download/v${GH_CLI_VERSION}/gh_${GH_CLI_VERSION}_linux_386.tar.gz -O ghcli.tar.gz \
  && tar --strip-components=1 -xf ghcli.tar.gz \
  && mv bin/gh /usr/local/bin && cd ../ && rm -rf ./ghcli

ARG TERRAFORM_VERSION=1.4.5
RUN curl -L -O "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" && \
  unzip "terraform_${TERRAFORM_VERSION}_linux_amd64.zip" -d /usr/local/bin && \
  rm -f "terraform_${TERRAFORM_VERSION}_linux_amd64.zip"

ARG TOFU_VERSION=1.7.2
RUN wget https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_386.apk -O tofu.apk && \
  apk add --allow-untrusted tofu.apk

ARG HCLEDIT_VERSION=0.2.8
RUN wget https://github.com/minamijoyo/hcledit/releases/download/v${HCLEDIT_VERSION}/hcledit_${HCLEDIT_VERSION}_linux_amd64.tar.gz \
  && tar -zxvf hcledit_${HCLEDIT_VERSION}_linux_amd64.tar.gz \
  && mv hcledit /usr/local/bin \
  && chmod +x /usr/local/bin/hcledit \
  && rm hcledit_${HCLEDIT_VERSION}_linux_amd64.tar.gz

ARG GHTOKEN_VERSION=2.0.1
RUN wget -O ghtoken \
  https://github.com/Link-/gh-token/releases/download/v${GHTOKEN_VERSION}/linux-amd64 && \
  echo "f76e8cb35f0b04b59073a486cc952e50fa9f1c930a25619ea9abcf44a13165c4  ghtoken" | \
  shasum -c - && \
  chmod u+x ./ghtoken && \
  mv ./ghtoken /usr/local/bin/ghtoken

RUN wget https://github.com/mike-engel/jwt-cli/releases/download/4.0.0/jwt-linux.tar.gz \
  && echo "6b0740c3f4c7134a0cbcf802b95b033bd2246d592ad16aa2ee2d80e5b289b4d6  jwt-linux.tar.gz" > jwt-linux.sha256 \
  && shasum --check --status ./jwt-linux.sha256 \
  && tar -xzf jwt-linux.tar.gz \
  && mv jwt /usr/local/bin/jwt
