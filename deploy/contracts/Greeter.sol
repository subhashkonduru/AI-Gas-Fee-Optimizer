// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Greeter {
  string public greeting;

  constructor(string memory _g) {
    greeting = _g;
  }

  function greet() public view returns (string memory) {
    return greeting;
  }

  function setGreeting(string memory _g) public {
    greeting = _g;
  }
}
