.PHONY: build install clean uninstall publish dependencies mrproper increment-version

# Read current version from package.json
VERSION := $(shell node -p "require('./package.json').version")

increment-version:
	@echo "Current version: $(VERSION)"
	@bash -c 'CURRENT_VERSION=$(VERSION); \
	IFS="." read -r major minor patch <<< "$$CURRENT_VERSION"; \
	NEW_PATCH=$$((patch + 1)); \
	NEW_VERSION="$$major.$$minor.$$NEW_PATCH"; \
	echo "New version: $$NEW_VERSION"; \
	sed -i "s/\"version\": \"$$CURRENT_VERSION\"/\"version\": \"$$NEW_VERSION\"/" package.json; \
	echo "Version bumped to $$NEW_VERSION"'

build: clean increment-version
	npm install
	yarn install
	python -m build 

install: build
	pip install dist/*.whl --force-reinstall

clean: uninstall
	npm run clean || true
	npm run clean:labextension || true
	rm -rf dist lib || true

uninstall:
	pip uninstall -y dist/*.whl 2>/dev/null || true

publish: install
	twine upload dist/*

install-dependencies:
	conda install -y nodejs yarn --update-all
	pip install twine

mrproper: clean uninstall
	rm -rf node_modules .yarn || true
	rm package-lock.json yarn.lock

