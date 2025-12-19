.PHONY: build run test clean

build:
	go build -o pricer-runner-backend main.go clients.go

run:
	go run main.go clients.go

test:
	go test ./...

clean:
	rm -f pricer-runner-backend
	go clean

install:
	go mod download

