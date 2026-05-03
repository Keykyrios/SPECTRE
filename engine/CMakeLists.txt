cmake_minimum_required(VERSION 3.16)
project(spectre_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Maximum compiler optimization
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -DNDEBUG -flto")

# Default to Release if not specified
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# ─── Find pybind11 ───────────────────────────────────────────────────────────
find_package(pybind11 REQUIRED)

# ─── Engine library (static) ────────────────────────────────────────────────
add_library(spectre_core STATIC
    src/graph.cpp
    src/detector.cpp
    src/entropy.cpp
)

target_include_directories(spectre_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_options(spectre_core PRIVATE
    -Wall -Wextra -Wpedantic
)

# ─── Python module ───────────────────────────────────────────────────────────
pybind11_add_module(spectre_engine
    src/bindings.cpp
)

target_link_libraries(spectre_engine PRIVATE
    spectre_core
)

# ─── Install ─────────────────────────────────────────────────────────────────
install(TARGETS spectre_engine
    LIBRARY DESTINATION ${CMAKE_INSTALL_PREFIX}/lib
)
